import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'ID of the linked authentication identity' })
  @IsUUID()
  identityId!: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+14155550123' })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'Morgan' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  preferredLanguage?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  preferredCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePicture?: string;
}