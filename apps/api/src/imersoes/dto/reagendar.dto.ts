import { IsInt, Min } from 'class-validator';

export class ReagendarDto {
  @IsInt()
  @Min(1)
  novaImersaoId!: number;
}
