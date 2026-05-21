import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { CpfLoginDto } from './dto/cpf-login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { firstName } from '../common/utils/cpf';
import { LovablePrismaService } from '../prisma/lovable-prisma.service';
import { STATUS_PENDENTES_MULTA } from '../imersoes/status.constants';

const COOKIE_NAME = 'imersao_session';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly lovable: LovablePrismaService,
  ) {}

  @Post('cpf')
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async loginCpf(@Body() body: CpfLoginDto, @Req() req: Request) {
    await this.smallJitter();
    return this.auth.iniciarLoginPorCpf(body.cpf, this.requestCtx(req));
  }

  @Post('otp')
  @HttpCode(200)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async verifyOtp(
    @Body() body: OtpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verificarOtp(body.cpf, body.codigo, this.requestCtx(req));
    res.cookie(COOKIE_NAME, result.token, this.cookieOpts());
    return {
      status: 'ok',
      primeiroNome: result.primeiroNome,
      matricula: result.matricula,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(COOKIE_NAME, this.clearCookieOpts());
    await this.auth.registrarLogout(user.matricula, this.requestCtx(req));
    return { status: 'ok' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const aluno = await this.lovable.pfAlunos.findUnique({
      where: { matricula: user.matricula },
      select: { statusFinanceiro: true, turma: true },
    });
    const punicao = await this.lovable.pfPunicoes.findFirst({
      where: { matricula: user.matricula, punicaoFim: { gte: new Date() } },
      select: { motivo: true },
    });
    // Pendência de multa: linha em status 4/5 ainda não paga. Sem filtro de
    // data — casa com o gate de checarBloqueiosOuLancar (a multa é uma dívida
    // e bloqueia mesmo depois da imersão passar).
    const pendenciaMulta = await this.lovable.pfImersoesAgendamento.findFirst({
      where: {
        matricula: user.matricula,
        status: { in: STATUS_PENDENTES_MULTA },
        pagouMulta: false,
      },
      select: { idImersao: true },
    });
    return {
      matricula: user.matricula,
      nome: user.nome,
      email: user.email,
      primeiroNome: firstName(user.nome),
      turma: aluno?.turma ?? null,
      bloqueios: {
        inadimplente: /inadimplent/i.test(aluno?.statusFinanceiro ?? ''),
        punicao: !!punicao,
        pendenciaMulta: !!pendenciaMulta,
      },
    };
  }

  private cookieOpts() {
    const secure = (process.env.COOKIE_SECURE ?? 'false') === 'true';
    const domain = process.env.COOKIE_DOMAIN;
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      domain: domain && domain !== 'localhost' ? domain : undefined,
      path: '/',
      maxAge: 1000 * 60 * 30,
    };
  }

  private clearCookieOpts() {
    const { maxAge: _maxAge, ...rest } = this.cookieOpts();
    return rest;
  }

  private requestCtx(req: Request) {
    const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const ip = fwd ?? req.ip ?? req.socket?.remoteAddress ?? null;
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;
    return { ip, userAgent };
  }

  private smallJitter(): Promise<void> {
    const ms = 150 + Math.floor(Math.random() * 250);
    return new Promise((r) => setTimeout(r, ms));
  }
}
