import { Module } from '@nestjs/common';
import { ImersoesController } from './imersoes.controller';
import { ImersoesService } from './imersoes.service';

@Module({
  controllers: [ImersoesController],
  providers: [ImersoesService],
  exports: [ImersoesService],
})
export class ImersoesModule {}
