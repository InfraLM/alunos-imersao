import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { ImersoesModule } from '../imersoes/imersoes.module';

@Module({
  imports: [ImersoesModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
