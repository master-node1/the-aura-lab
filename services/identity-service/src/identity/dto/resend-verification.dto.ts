import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, ValidateIf } from 'class-validator';
import { IssueVerificationDto } from './issue-verification.dto';

export class ResendVerificationDto extends IssueVerificationDto {
  @ApiPropertyOptional({ example: 'jane.doe@example.com', description: 'Required when channel is email' })
  @ValidateIf((dto: ResendVerificationDto) => dto.channel === 'email')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+14155552671', description: 'Required when channel is mobile' })
  @ValidateIf((dto: ResendVerificationDto) => dto.channel === 'mobile')
  @IsString()
  mobileNumber?: string;
}
