import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ description: 'Identity ID to assign role to' })
  @IsUUID()
  identityId!: string;

  @ApiPropertyOptional({ description: 'Admin user who is assigning the role' })
  @IsOptional()
  @IsString()
  assignedBy?: string;
}
