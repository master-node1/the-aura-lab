import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyMobileDto {
  @ApiProperty({ example: '123456', description: 'One-time password (OTP) sent to the mobile number' })
  @IsString()
  otp!: string;
}
