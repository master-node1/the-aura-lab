import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'abc123token', description: 'Email verification token' })
  @IsString()
  token!: string;
}
