import { PartialType } from '@nestjs/swagger';
import { CreateIdentityDto } from './create-identity.dto';

export class UpdateIdentityDto extends PartialType(CreateIdentityDto) {}
