import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateIdentityDto } from './create-identity.dto';

export class InternalCreateIdentityDto extends CreateIdentityDto {
  @ApiPropertyOptional({
    description: 'Use this ID instead of generating one, so the identity shares the auth user ID',
  })
  @IsOptional()
  @IsUUID()
  id?: string;
}
