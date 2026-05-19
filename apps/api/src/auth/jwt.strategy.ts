import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

const COOKIE_NAME = 'imersao_session';

export interface JwtPayload {
  sub: string;
  nome: string | null;
  email: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16) {
      throw new Error('JWT_SECRET ausente ou muito curto.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = (req?.cookies?.[COOKIE_NAME] as string | undefined) ?? null;
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return {
      matricula: payload.sub,
      nome: payload.nome ?? null,
      email: payload.email ?? null,
    };
  }
}
