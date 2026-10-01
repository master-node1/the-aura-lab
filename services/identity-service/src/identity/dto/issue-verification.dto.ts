import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const VERIFICATION_CHANNELS = ['email', 'mobile'] as const;
export type VerificationChannelName = (typeof VERIFICATION_CHANNELS)[number];

export class IssueVerificationDto {
  @ApiProperty({ enum: VERIFICATION_CHANNELS, example: 'email' })
  @IsIn(VERIFICATION_CHANNELS)
  channel!: VerificationChannelName;
}
