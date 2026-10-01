import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateIdentityDto {
  @ApiProperty({ example: 'jane.doe@example.com', description: 'Primary email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Display name shown in the UI', minLength: 1 })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiPropertyOptional({ example: 'Jane', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+14155552671', description: 'Mobile phone number in E.164 format' })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'web', description: 'Source of registration (web, mobile, google, etc.)' })
  @IsOptional()
  @IsString()
  registrationSource?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Preferred language code (BCP 47)', default: 'en' })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'UTC', description: 'IANA time zone identifier', default: 'UTC' })
  @IsOptional()
  @IsString()
  timeZone?: string;
}
