import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class OtpVerifyDto {
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpf!: string;

  @IsString()
  @Length(6, 6)
  codigo!: string;
}
