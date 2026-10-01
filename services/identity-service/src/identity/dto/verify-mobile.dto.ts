import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyMobileDto {
  @ApiProperty({ example: '+14155552671', description: 'Mobile number the OTP was sent to' })
  @IsString()
  mobileNumber!: string;

  @ApiProperty({ example: '123456', description: 'Six-digit one-time password (OTP)' })
  @Matches(/^\d{6}$/, { message: 'otp must be 6 digits' })
  otp!: string;
}
