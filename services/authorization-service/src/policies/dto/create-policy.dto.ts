import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyDto {
  @ApiProperty({ example: 'admin-full-access' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Grants full access to all resources for admins' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Array of policy rule objects',
    type: [Object],
    example: [{ effect: 'allow', resource: '*', action: '*' }],
  })
  @IsOptional()
  @IsArray()
  rules?: object[];

  @ApiPropertyOptional({ default: true, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
