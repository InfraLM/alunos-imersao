import { Global, Module } from '@nestjs/common';
import { LovablePrismaService } from './lovable-prisma.service';
import { ImersaoPrismaService } from './imersao-prisma.service';

@Global()
@Module({
  providers: [LovablePrismaService, ImersaoPrismaService],
  exports: [LovablePrismaService, ImersaoPrismaService],
})
export class PrismaModule {}
