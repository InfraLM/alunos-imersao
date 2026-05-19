import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { ImersoesModule } from './imersoes/imersoes.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 20 },
      { name: 'auth', ttl: 60_000, limit: 5 },
    ]),
    PrismaModule,
    MailModule,
    AuthModule,
    ImersoesModule,
    MeModule,
  ],
})
export class AppModule {}
