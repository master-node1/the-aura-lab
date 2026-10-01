import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LinkProviderDto {
  @ApiProperty({
    example: 'google',
    description: 'Identity provider name (local, google, apple, facebook, microsoft)',
  })
  @IsString()
  provider!: string;

  @ApiProperty({ example: '117834928374619203456', description: 'External identifier from the provider' })
  @IsString()
  externalId!: string;

  @ApiPropertyOptional({ example: false, description: 'Whether this should be the primary provider', default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
