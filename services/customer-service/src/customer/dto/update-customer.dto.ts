import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+14155550123' })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'Alex' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Morgan' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 10)
  preferredLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  preferredCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePicture?: string;
}