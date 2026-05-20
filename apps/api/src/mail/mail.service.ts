import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { google, type Auth } from 'googleapis';

import { ImersaoPrismaService } from '../prisma/imersao-prisma.service';

interface OtpEmailPayload {
  matricula: string;
  to: string;
  primeiroNome: string;
  codigo: string;
  expiraEmMinutos: number;
}

interface ConfirmacaoImersaoPayload {
  matricula: string;
  to: string;
  primeiroNome: string;
  modo: 'agendamento' | 'reagendamento';
  tipoImersao: string;
  dataImersao: Date;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  linkGrupoWhatsapp: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly oauth2: Auth.OAuth2Client | null;
  private readonly user: string | null;
  private readonly from: string;

  constructor(private readonly imersaoDb: ImersaoPrismaService) {
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
    this.user = process.env.GMAIL_USER ?? null;
    this.from = process.env.MAIL_FROM ?? this.user ?? 'no-reply@example.com';

    if (clientId && clientSecret && refreshToken && this.user) {
      this.oauth2 = new google.auth.OAuth2(clientId, clientSecret);
      this.oauth2.setCredentials({ refresh_token: refreshToken });
    } else {
      this.oauth2 = null;
      this.logger.warn(
        'OAuth2 do Gmail nao configurado (GMAIL_USER/GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN). Emails serao impressos no console.',
      );
    }
  }

  async sendOtp({
    matricula,
    to,
    primeiroNome,
    codigo,
    expiraEmMinutos,
  }: OtpEmailPayload): Promise<void> {
    const subject = `Seu codigo de acesso: ${codigo}`;
    const html = otpHtmlTemplate({ primeiroNome, codigo, expiraEmMinutos });
    const text = `Ola, ${primeiroNome}! Seu codigo de acesso ao Portal de Imersoes e ${codigo}. Ele expira em ${expiraEmMinutos} minutos.`;

    let providerId: string | null = null;
    let status: 'sent' | 'failed' = 'sent';
    let erro: string | null = null;

    try {
      const transporter = await this.buildTransporter();
      if (!transporter) {
        this.logger.log(`[DEV] OTP para ${to}: ${codigo}`);
      } else {
        const info = await transporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
          text,
        });
        providerId = info.messageId ?? null;
      }
    } catch (err) {
      status = 'failed';
      erro = (err as Error).message;
      this.logger.error(`Falha ao enviar email: ${erro}`);
      throw err;
    } finally {
      this.imersaoDb.emailLog
        .create({
          data: {
            matricula,
            destinatario: to,
            tipo: 'otp',
            status,
            providerId,
            erro,
          },
        })
        .catch((e) => {
          this.logger.error(`Falha ao persistir email_log: ${(e as Error).message}`);
        });
    }
  }

  async sendConfirmacaoImersao({
    matricula,
    to,
    primeiroNome,
    modo,
    tipoImersao,
    dataImersao,
    local,
    cidade,
    estado,
    linkGrupoWhatsapp,
  }: ConfirmacaoImersaoPayload): Promise<void> {
    const acao = modo === 'reagendamento' ? 'Reagendamento confirmado' : 'Inscricao confirmada';
    const subject = `${acao} - ${tipoImersao}`;
    const fimDeSemana = formatarFimDeSemanaEmail(dataImersao);
    const localTexto = formatarLocalEmail(local, cidade, estado);
    const html = confirmacaoImersaoHtmlTemplate({
      primeiroNome,
      acao,
      tipoImersao,
      fimDeSemana,
      localTexto,
      linkGrupoWhatsapp,
    });
    const text =
      `Ola, ${primeiroNome}! ${acao} para a imersao de ${tipoImersao}. ` +
      `Quando: ${fimDeSemana}.` +
      (localTexto ? ` Local: ${localTexto}.` : '') +
      (linkGrupoWhatsapp ? ` Grupo do WhatsApp: ${linkGrupoWhatsapp}` : '');

    let providerId: string | null = null;
    let status: 'sent' | 'failed' = 'sent';
    let erro: string | null = null;

    try {
      const transporter = await this.buildTransporter();
      if (!transporter) {
        this.logger.log(`[DEV] Confirmacao de imersao para ${to}: ${subject}`);
      } else {
        const info = await transporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
          text,
        });
        providerId = info.messageId ?? null;
      }
    } catch (err) {
      status = 'failed';
      erro = (err as Error).message;
      this.logger.error(`Falha ao enviar email de confirmacao: ${erro}`);
    } finally {
      this.imersaoDb.emailLog
        .create({
          data: {
            matricula,
            destinatario: to,
            tipo: 'imersao_confirmada',
            status,
            providerId,
            erro,
          },
        })
        .catch((e) => {
          this.logger.error(`Falha ao persistir email_log: ${(e as Error).message}`);
        });
    }
  }

  private async buildTransporter(): Promise<Transporter | null> {
    if (!this.oauth2 || !this.user) return null;

    const { token } = await this.oauth2.getAccessToken();
    if (!token) {
      throw new Error('Nao foi possivel obter access token do Google OAuth2');
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.user,
        clientId: process.env.GMAIL_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
        refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN!,
        accessToken: token,
      },
    });
  }
}

function otpHtmlTemplate({
  primeiroNome,
  codigo,
  expiraEmMinutos,
}: {
  primeiroNome: string;
  codigo: string;
  expiraEmMinutos: number;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:100%;box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="font-size:14px;color:#6b7280;letter-spacing:.04em;text-transform:uppercase;">Imersoes LM</div>
                <h1 style="font-size:22px;color:#111827;margin:8px 0 16px 0;">Ola, ${escapeHtml(primeiroNome)}</h1>
                <p style="color:#374151;line-height:1.55;font-size:15px;margin:0 0 24px 0;">
                  Use o codigo abaixo para acessar o portal e gerenciar suas imersoes.
                  Ele expira em <strong>${expiraEmMinutos} minutos</strong>.
                </p>
                <div style="background:#0A0A0A;color:#fafafa;font-size:34px;letter-spacing:.5em;text-align:center;padding:20px;border-radius:10px;font-variant-numeric:tabular-nums;">
                  ${escapeHtml(codigo)}
                </div>
                <p style="color:#6b7280;font-size:13px;line-height:1.55;margin:24px 0 0 0;">
                  Se voce nao solicitou este codigo, pode ignorar este email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px;border-top:1px solid #f1f5f9;">
                <div style="color:#9ca3af;font-size:12px;">Liberdade Medica Edu &middot; Pos-Graduacao</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const MESES_EMAIL = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "Sabado e domingo - 13 e 14 de maio de 2026" (a partir do sabado). */
function formatarFimDeSemanaEmail(sabado: Date): string {
  if (Number.isNaN(sabado.getTime())) return '';
  const domingo = new Date(sabado.getTime() + 86_400_000);
  const mesmoMes =
    sabado.getMonth() === domingo.getMonth() &&
    sabado.getFullYear() === domingo.getFullYear();
  const parteSab = mesmoMes
    ? `${sabado.getDate()}`
    : `${sabado.getDate()} de ${MESES_EMAIL[sabado.getMonth()]}` +
      (sabado.getFullYear() !== domingo.getFullYear() ? ` de ${sabado.getFullYear()}` : '');
  const parteDom = `${domingo.getDate()} de ${MESES_EMAIL[domingo.getMonth()]} de ${domingo.getFullYear()}`;
  return `Sabado e domingo - ${parteSab} e ${parteDom}`;
}

/** "local - Cidade, Estado", omitindo partes ausentes. */
function formatarLocalEmail(
  local: string | null,
  cidade: string | null,
  estado: string | null,
): string {
  const cidadeEstado = [cidade, estado]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ');
  return [local?.trim(), cidadeEstado].filter(Boolean).join(' - ');
}

function confirmacaoImersaoHtmlTemplate({
  primeiroNome,
  acao,
  tipoImersao,
  fimDeSemana,
  localTexto,
  linkGrupoWhatsapp,
}: {
  primeiroNome: string;
  acao: string;
  tipoImersao: string;
  fimDeSemana: string;
  localTexto: string;
  linkGrupoWhatsapp: string | null;
}): string {
  const linhaLocal = localTexto
    ? `<tr>
         <td style="padding:14px 20px;border-top:1px solid #f1f5f9;">
           <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Local</div>
           <div style="font-size:15px;color:#111827;margin-top:3px;">${escapeHtml(localTexto)}</div>
         </td>
       </tr>`
    : '';
  const botaoWhatsapp = linkGrupoWhatsapp
    ? `<tr>
         <td style="padding:8px 32px 4px 32px;">
           <a href="${escapeHtml(linkGrupoWhatsapp)}" style="display:block;background:#25D366;color:#ffffff;text-decoration:none;text-align:center;font-size:15px;font-weight:600;padding:15px;border-radius:10px;">
             Entrar no grupo do WhatsApp
           </a>
           <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:10px 0 0 0;text-align:center;">
             Entre no grupo para receber os avisos e o material da imersao.
           </p>
         </td>
       </tr>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;max-width:100%;box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <tr>
              <td style="background:#0A0A0A;padding:28px 32px;">
                <div style="font-size:13px;color:#a1a1aa;letter-spacing:.06em;text-transform:uppercase;">Imersoes LM</div>
                <div style="font-size:24px;color:#fafafa;font-weight:600;margin-top:6px;">${escapeHtml(acao)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <h1 style="font-size:20px;color:#111827;margin:0 0 8px 0;">Ola, ${escapeHtml(primeiroNome)}</h1>
                <p style="color:#374151;line-height:1.55;font-size:15px;margin:0 0 20px 0;">
                  Sua vaga na imersao abaixo esta garantida. Guarde este e-mail com os detalhes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 20px;">
                      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Imersao</div>
                      <div style="font-size:17px;color:#111827;font-weight:600;margin-top:3px;">${escapeHtml(tipoImersao)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;border-top:1px solid #f1f5f9;">
                      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;">Quando</div>
                      <div style="font-size:15px;color:#111827;margin-top:3px;">${escapeHtml(fimDeSemana)}</div>
                    </td>
                  </tr>
                  ${linhaLocal}
                </table>
              </td>
            </tr>
            <tr><td style="height:18px;"></td></tr>
            ${botaoWhatsapp}
            <tr>
              <td style="padding:22px 32px 28px 32px;">
                <p style="color:#6b7280;font-size:13px;line-height:1.55;margin:0;">
                  Precisa cancelar ou reagendar? Faca isso pelo portal, em "Minhas inscricoes".
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px;border-top:1px solid #f1f5f9;">
                <div style="color:#9ca3af;font-size:12px;">Liberdade Medica Edu &middot; Pos-Graduacao</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
