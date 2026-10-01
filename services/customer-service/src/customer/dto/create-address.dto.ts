import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'Alex Morgan' })
  @IsString()
  @Length(1, 150)
  recipientName!: string;

  @ApiPropertyOptional({ example: '+14155550123' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '100 Market Street' })
  @IsString()
  @Length(1, 200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'San Francisco' })
  @IsString()
  @Length(1, 100)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '94105' })
  @IsString()
  @Length(1, 20)
  postalCode!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsISO31661Alpha2()
  country!: string;

  @ApiPropertyOptional({ enum: AddressType, default: AddressType.SHIPPING })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultShipping?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultBilling?: boolean;
}