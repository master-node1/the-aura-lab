import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { LinkProviderDto } from './dto/link-provider.dto';

/** Public, JWT-protected identity endpoints. Creation is internal (see InternalIdentityController). */
@ApiTags('identity')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Missing or invalid access token' })
@Controller('identities')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  // ─── IDENTITIES ──────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get identity by ID' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Identity record' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  findById(@Param('id') id: string) {
    return this.identityService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update identity profile fields' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Identity updated successfully' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  updateIdentity(@Param('id') id: string, @Body() dto: UpdateIdentityDto) {
    return this.identityService.updateIdentity(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an identity (sets status to DELETED)' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Identity soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  deleteIdentity(@Param('id') id: string) {
    return this.identityService.deleteIdentity(id);
  }

  // ─── PROVIDERS ────────────────────────────────────────────────────────────────

  @Post(':id/providers')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link an external identity provider to an identity' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 201, description: 'Provider linked successfully' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  @ApiResponse({ status: 409, description: 'Provider/externalId combination already exists' })
  linkProvider(@Param('id') id: string, @Body() dto: LinkProviderDto) {
    return this.identityService.linkProvider(id, dto);
  }

  @Delete(':id/providers/:providerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an identity provider from an identity' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiParam({ name: 'providerId', description: 'IdentityProvider UUID' })
  @ApiResponse({ status: 200, description: 'Provider unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Identity or provider not found' })
  unlinkProvider(@Param('id') id: string, @Param('providerId') providerId: string) {
    return this.identityService.unlinkProvider(id, providerId);
  }

  // ─── STATUS MANAGEMENT ────────────────────────────────────────────────────────

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an identity (sets status to SUSPENDED)' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Identity suspended successfully' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  suspendIdentity(@Param('id') id: string) {
    return this.identityService.suspendIdentity(id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended identity (sets status to ACTIVE)' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Identity reactivated successfully' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  reactivateIdentity(@Param('id') id: string) {
    return this.identityService.reactivateIdentity(id);
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

  @Get(':id/audit-logs')
  @ApiOperation({ summary: 'Get audit log entries for an identity' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'List of audit log entries ordered by most recent first' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  getAuditLogs(@Param('id') id: string) {
    return this.identityService.getAuditLogs(id);
  }
}
