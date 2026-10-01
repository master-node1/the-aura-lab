import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckAccessDto {
  @ApiProperty({ description: 'The identity ID requesting access' })
  @IsUUID()
  identityId: string;

  @ApiProperty({
    description: 'The resource being accessed',
    example: 'product',
  })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({
    description: 'The action being attempted',
    example: 'create',
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({
    description: 'Additional context for ABAC evaluation',
    type: Object,
    example: { tenantId: 'abc123', region: 'us-east' },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
