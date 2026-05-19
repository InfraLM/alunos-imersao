import { IsString, MaxLength, MinLength } from 'class-validator';

export class CpfLoginDto {
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpf!: string;
}
