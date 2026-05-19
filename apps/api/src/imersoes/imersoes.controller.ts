import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ImersoesService } from './imersoes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('imersoes')
export class ImersoesController {
  constructor(private readonly imersoes: ImersoesService) {}

  @Get('disponiveis')
  async disponiveis(@CurrentUser() user: AuthenticatedUser) {
    const lista = await this.imersoes.listarDisponiveis(user.matricula);
    return { imersoes: lista };
  }

  @Get(':id')
  async detalhar(@Param('id', ParseIntPipe) id: number) {
    return this.imersoes.detalhar(id);
  }

  @Post(':id/inscrever')
  async inscrever(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.imersoes.inscrever(user.matricula, id);
  }
}
