import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { isEmail } from 'class-validator';
import { InternalServiceGuard } from '../auth/internal-service.guard';
import { Public } from '../auth/public.decorator';
import { InternalCreateIdentityDto } from './dto/internal-create-identity.dto';
import { IssueVerificationDto } from './dto/issue-verification.dto';
import { IdentityService } from './identity.service';
import { VerificationService } from './verification.service';

/**
 * Service-to-service endpoints used before the user has a JWT (signup, login lookups).
 * Not routed by the API gateway; callers must send the x-internal-token header.
 */
@ApiTags('identity-internal')
@ApiSecurity('internal')
@ApiResponse({ status: 401, description: 'Missing or invalid x-internal-token' })
@Public()
@UseGuards(InternalServiceGuard)
@Controller('internal/identities')
export class InternalIdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly verificationService: VerificationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an identity during signup' })
  @ApiResponse({ status: 201, description: 'Identity created (PENDING_VERIFICATION)' })
  @ApiResponse({ status: 409, description: 'Email, mobile number or ID already registered' })
  create(@Body() dto: InternalCreateIdentityDto) {
    return this.identityService.createIdentity(dto);
  }

  @Get('by-email')
  @ApiOperation({ summary: 'Look up an identity by email (login)' })
  @ApiQuery({ name: 'email', required: true })
  @ApiResponse({ status: 200, description: 'Identity with providers' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  async findByEmail(@Query('email') email: string) {
    if (!email || !isEmail(email)) throw new BadRequestException('A valid email query parameter is required');
    const identity = await this.identityService.findByEmail(email);
    if (!identity) throw new NotFoundException('Identity not found');
    return identity;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an identity, e.g. to check its status before issuing tokens' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Identity with providers' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.identityService.findById(id);
  }

  @Post(':id/verifications')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue an email token or mobile OTP and send it to the user' })
  @ApiParam({ name: 'id', description: 'Identity UUID' })
  @ApiResponse({ status: 201, description: 'Code issued. devCode is included outside production only.' })
  @ApiResponse({ status: 400, description: 'Identity has no mobile number' })
  @ApiResponse({ status: 404, description: 'Identity not found or deleted' })
  @ApiResponse({ status: 409, description: 'Channel already verified' })
  @ApiResponse({ status: 503, description: 'No delivery channel configured (production)' })
  issueVerification(@Param('id', ParseUUIDPipe) id: string, @Body() dto: IssueVerificationDto) {
    return this.verificationService.issue(id, dto.channel);
  }
}
