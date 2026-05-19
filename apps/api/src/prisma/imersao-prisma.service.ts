import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma-clients/imersao';

@Injectable()
export class ImersaoPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImersaoPrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Imersao DB conectado (imersao-aluno / schema public)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
