import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MeService } from './me.service';
import { ReagendarDto } from '../imersoes/dto/reagendar.dto';
import { ImersoesService } from '../imersoes/imersoes.service';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly imersoes: ImersoesService,
  ) {}

  @Get('inscricoes')
  async minhas(@CurrentUser() user: AuthenticatedUser) {
    return { inscricoes: await this.me.listarInscricoes(user.matricula) };
  }

  @Get('historico')
  async historico(@CurrentUser() user: AuthenticatedUser) {
    return { historico: await this.me.listarHistorico(user.matricula) };
  }

  @Delete('inscricoes/:id')
  async cancelar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.imersoes.cancelar(user.matricula, id);
  }

  @Post('inscricoes/:id/reagendar')
  async reagendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReagendarDto,
  ) {
    return this.imersoes.reagendar(user.matricula, id, body.novaImersaoId);
  }
}
