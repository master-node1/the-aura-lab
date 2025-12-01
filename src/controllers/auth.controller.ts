import {
  Body,
  Controller,
  Post,
  Put,
  HttpStatus,
} from '@nestjs/common';
import { AuthCredentialsService } from './auth-credentials.service';
import {
  CreateCredentialsDTO,
  UpdateCredentialsDTO,
  ForgotPasswordDTO,
  LoginDTO,
} from './dto';

@Controller('auth')
export class AuthCredentialsController {
  constructor(private readonly authCredentialsService: AuthCredentialsService) {}

  /**
   * Create Credentials during profile creation event
   */
  @Post('create')
  async createCredentials(@Body() payload: CreateCredentialsDTO) {
    try {
      const result = await this.authCredentialsService.createAuthCredentials(payload);
      return {
        statusCode: result.status_code,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Failed to create credentials',
      };
    }
  }

  /**
   * Update password
   */
  @Put('update-password')
  async updatePassword(@Body() payload: UpdateCredentialsDTO) {
    const result = await this.authCredentialsService.updateAuthCredentials(payload);

    if (!result) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Invalid profile details. Unable to update password',
        data: null,
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Password updated successfully',
      data: result,
    };
  }

  /**
   * Forgot Password - send reset link/OTP/TOKEN
   */
  @Post('forgot-password')
  async forgotPassword(@Body() payload: ForgotPasswordDTO) {
    try {
      const result = await this.authCredentialsService.forgotPassword(payload);
      return {
        statusCode: result.status_code,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Forgot password failed',
      };
    }
  }

  /**
   * Login to account
   */
  @Post('login')
  async login(@Body() payload: LoginDTO) {
    const response = await this.authCredentialsService.loginToAccount(payload);

    return {
      statusCode: response.status_code,
      message: response.message,
      data: response.data,
    };
  }
}
