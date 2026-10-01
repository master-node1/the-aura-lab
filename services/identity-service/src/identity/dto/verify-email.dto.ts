import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'k3J9…', description: 'One-time token from the verification email link' })
  @IsString()
  @Length(16, 128)
  token!: string;
}
