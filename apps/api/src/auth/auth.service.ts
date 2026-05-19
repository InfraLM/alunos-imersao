import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { LovablePrismaService } from '../prisma/lovable-prisma.service';
import { ImersaoPrismaService } from '../prisma/imersao-prisma.service';
import { MailService } from '../mail/mail.service';
import { firstName, isValidCpfFormat, maskEmail, normalizeCpf } from '../common/utils/cpf';

const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_S = 60;

export type LoginOutcome =
  | { status: 'otp_enviado'; emailMascarado: string }
  | { status: 'bloqueado'; motivo: 'sem_email'; mensagem: string }
  | { status: 'nao_encontrado'; mensagem: string };

export type OtpVerifyOutcome = {
  status: 'ok';
  token: string;
  primeiroNome: string;
  matricula: string;
};

interface RequestCtx {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly lovable: LovablePrismaService,
    private readonly imersao: ImersaoPrismaService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  async iniciarLoginPorCpf(rawCpf: string, ctx: RequestCtx = {}): Promise<LoginOutcome> {
    const cpf = normalizeCpf(rawCpf);
    if (!isValidCpfFormat(cpf)) {
      throw new BadRequestException('CPF inválido');
    }

    const alunos = await this.lovable.$queryRawUnsafe<
      Array<{ matricula: string; nome: string | null; email: string | null }>
    >(
      `SELECT matricula, nome, email
         FROM lovable.pf_alunos
        WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = $1
        LIMIT 2`,
      cpf,
    );

    if (alunos.length === 0) {
      await this.logAccess(null, 'login_cpf_nao_encontrado', ctx);
      return {
        status: 'nao_encontrado',
        mensagem:
          'Não localizamos seu cadastro. Verifique o CPF ou entre em contato com a secretaria.',
      };
    }
    if (alunos.length > 1) {
      this.logger.error(`CPF duplicado em pf_alunos: ${cpf}`);
      throw new BadRequestException(
        'Há mais de um cadastro com este CPF. Entre em contato com o suporte.',
      );
    }

    const aluno = alunos[0];

    if (!aluno.email) {
      await this.logAccess(aluno.matricula, 'bloqueado_sem_email', ctx);
      return {
        status: 'bloqueado',
        motivo: 'sem_email',
        mensagem:
          'Não há email cadastrado em sua matrícula. Entre em contato com o suporte para atualizar.',
      };
    }

    await this.gerarEEnviarOtp(aluno.matricula, aluno.nome, aluno.email);
    await this.logAccess(aluno.matricula, 'login_cpf_ok', ctx);

    return {
      status: 'otp_enviado',
      emailMascarado: maskEmail(aluno.email),
    };
  }

  async verificarOtp(
    rawCpf: string,
    codigo: string,
    ctx: RequestCtx = {},
  ): Promise<OtpVerifyOutcome> {
    const cpf = normalizeCpf(rawCpf);
    if (!isValidCpfFormat(cpf) || !/^\d{6}$/.test(codigo)) {
      throw new BadRequestException('Dados inválidos');
    }

    const alunos = await this.lovable.$queryRawUnsafe<
      Array<{ matricula: string; nome: string | null; email: string | null }>
    >(
      `SELECT matricula, nome, email
         FROM lovable.pf_alunos
        WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = $1
        LIMIT 1`,
      cpf,
    );
    if (alunos.length === 0) {
      throw new NotFoundException('Cadastro não localizado.');
    }
    const aluno = alunos[0];

    const otp = await this.imersao.imersaoOtp.findUnique({
      where: { matricula: aluno.matricula },
    });
    if (!otp) {
      await this.logAccess(aluno.matricula, 'otp_expirado', ctx, 'sem_otp');
      throw new UnauthorizedException('Código expirado. Solicite um novo.');
    }
    if (otp.expiraEm < new Date()) {
      await this.imersao.imersaoOtp.delete({ where: { matricula: aluno.matricula } });
      await this.logAccess(aluno.matricula, 'otp_expirado', ctx);
      throw new UnauthorizedException('Código expirado. Solicite um novo.');
    }
    if (otp.tentativas >= OTP_MAX_ATTEMPTS) {
      await this.imersao.imersaoOtp.delete({ where: { matricula: aluno.matricula } });
      await this.logAccess(aluno.matricula, 'otp_falhou', ctx, 'maximo_tentativas');
      throw new ForbiddenException(
        'Muitas tentativas com código incorreto. Solicite um novo.',
      );
    }

    const ok = await bcrypt.compare(codigo, otp.codigoHash);
    if (!ok) {
      await this.imersao.imersaoOtp.update({
        where: { matricula: aluno.matricula },
        data: { tentativas: { increment: 1 } },
      });
      await this.logAccess(aluno.matricula, 'otp_falhou', ctx);
      throw new UnauthorizedException('Código incorreto.');
    }

    // OTP correto: consome SEMPRE (anti-replay)
    await this.imersao.imersaoOtp.delete({ where: { matricula: aluno.matricula } });
    await this.logAccess(aluno.matricula, 'otp_ok', ctx);

    // Gates de inadimplência/punição NÃO bloqueiam o login — são checados nas mutations.
    // O aluno bloqueado continua entrando para ver suas inscrições.

    const token = await this.jwt.signAsync({
      sub: aluno.matricula,
      nome: aluno.nome ?? null,
      email: aluno.email ?? null,
    });

    return {
      status: 'ok',
      token,
      primeiroNome: firstName(aluno.nome),
      matricula: aluno.matricula,
    };
  }

  async registrarLogout(matricula: string, ctx: RequestCtx = {}): Promise<void> {
    await this.logAccess(matricula, 'logout', ctx);
  }

  private async gerarEEnviarOtp(
    matricula: string,
    nome: string | null,
    email: string,
  ): Promise<void> {
    const existente = await this.imersao.imersaoOtp.findUnique({ where: { matricula } });
    if (existente) {
      const idadeSeg = (Date.now() - existente.criadoEm.getTime()) / 1000;
      if (idadeSeg < OTP_RESEND_COOLDOWN_S) {
        throw new BadRequestException(
          `Aguarde ${Math.ceil(OTP_RESEND_COOLDOWN_S - idadeSeg)}s para reenviar o código.`,
        );
      }
    }

    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const codigoHash = await bcrypt.hash(codigo, 10);
    const expiraEm = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await this.imersao.imersaoOtp.upsert({
      where: { matricula },
      create: { matricula, codigoHash, expiraEm, tentativas: 0 },
      update: { codigoHash, expiraEm, tentativas: 0, criadoEm: new Date() },
    });

    await this.mail.sendOtp({
      matricula,
      to: email,
      primeiroNome: firstName(nome),
      codigo,
      expiraEmMinutos: OTP_TTL_MIN,
    });
  }

  private async logAccess(
    matricula: string | null,
    evento: string,
    ctx: RequestCtx,
    detalhe?: string,
  ): Promise<void> {
    try {
      await this.imersao.accessLog.create({
        data: {
          matricula,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          evento,
          detalhe: detalhe ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao persistir access_log: ${(err as Error).message}`);
    }
  }
}
