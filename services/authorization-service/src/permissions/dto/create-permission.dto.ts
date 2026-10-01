import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'product.create' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'product' })
  @IsString()
  @IsNotEmpty()
  resource!: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiPropertyOptional({ example: 'Allows creating new products' })
  @IsOptional()
  @IsString()
  description?: string;
}
