import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma-clients/lovable';

@Injectable()
export class LovablePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LovablePrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Lovable DB conectado (liberdade-medica / schema lovable)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
