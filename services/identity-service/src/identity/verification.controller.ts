import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyMobileDto } from './dto/verify-mobile.dto';
import { VerificationService } from './verification.service';

/**
 * Public verification endpoints. Users call these before they can log in, so they
 * need no JWT: the one-time code is the credential.
 */
@ApiTags('verification')
@Public()
@Controller()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address with the token from the email link' })
  @ApiResponse({ status: 200, description: '{ verified: true, channel: "email" }' })
  @ApiResponse({ status: 400, description: 'Invalid, expired or already used token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.verificationService.verifyEmail(dto.token);
  }

  @Post('verify-mobile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a mobile number with the six-digit OTP' })
  @ApiResponse({ status: 200, description: '{ verified: true, channel: "mobile" }' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, used or locked OTP' })
  verifyMobile(@Body() dto: VerifyMobileDto) {
    return this.verificationService.verifyMobile(dto.mobileNumber, dto.otp);
  }

  @Post('verifications/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a new code (same response whether or not the account exists)' })
  @ApiResponse({ status: 202, description: 'Request accepted' })
  async resend(@Body() dto: ResendVerificationDto) {
    await this.verificationService.resend(dto);
    return { message: 'If the account exists and is not yet verified, a new code has been sent' };
  }
}
