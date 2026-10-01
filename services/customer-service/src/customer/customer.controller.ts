import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AccessControlService } from '../auth/access-control.service';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { USER_ID_HEADER } from '../auth/jwt.strategy';
import { CustomerService } from './customer.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

class CustomerSearchQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

@ApiTags('customers')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Missing or invalid access token' })
@ApiResponse({ status: 403, description: 'Not the owner and missing the required permission' })
@ApiResponse({ status: 503, description: 'authorization-service unavailable' })
@Controller('customers')
export class CustomerController {
  constructor(
    private readonly customers: CustomerService,
    private readonly access: AccessControlService,
  ) {}

  /** The owner (JWT user ID == customer.identityId) passes; anyone else needs customer:<action>. */
  private async authorize(customerId: string, userId: string, action: string) {
    const ownerId = await this.customers.findOwnerIdentityId(customerId);
    await this.access.requireOwnerOrPermission(userId, ownerId, 'customer', action);
  }

  @Post()
  @ApiOperation({ summary: 'Create a customer profile linked to an identity' })
  async create(@Body() dto: CreateCustomerDto, @CurrentUserId() userId: string) {
    await this.access.requireOwnerOrPermission(userId, dto.identityId, 'customer', 'create');
    return this.customers.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search customers. Requires customer:read.' })
  async search(@Query() query: CustomerSearchQuery, @CurrentUserId() userId: string) {
    await this.access.requirePermission(userId, 'customer', 'read');
    return this.customers.search(query);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the profile for the authenticated user (identity ID from the JWT)' })
  getProfile(@Headers(USER_ID_HEADER) identityId: string) {
    return this.customers.findProfile(identityId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update the profile for the authenticated user (identity ID from the JWT)' })
  updateProfile(
    @Headers(USER_ID_HEADER) identityId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.updateProfile(identityId, dto);
  }

  @Get(':customerId')
  async getById(@Param('customerId', ParseUUIDPipe) customerId: string, @CurrentUserId() userId: string) {
    await this.authorize(customerId, userId, 'read');
    return this.customers.findById(customerId);
  }

  @Put(':customerId')
  async update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUserId() userId: string,
  ) {
    await this.authorize(customerId, userId, 'update');
    return this.customers.update(customerId, dto);
  }

  @Delete(':customerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Customer was soft-deleted' })
  async remove(@Param('customerId', ParseUUIDPipe) customerId: string, @CurrentUserId() userId: string) {
    await this.authorize(customerId, userId, 'delete');
    return this.customers.remove(customerId);
  }

  @Patch(':customerId/status')
  @ApiOperation({ summary: 'Change customer status. Requires customer:manage.' })
  async updateStatus(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentUserId() userId: string,
  ) {
    await this.access.requirePermission(userId, 'customer', 'manage');
    return this.customers.updateStatus(customerId, dto);
  }

  @Post(':customerId/addresses')
  async createAddress(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateAddressDto,
    @CurrentUserId() userId: string,
  ) {
    await this.authorize(customerId, userId, 'update');
    return this.customers.createAddress(customerId, dto);
  }

  @Get(':customerId/addresses')
  async listAddresses(@Param('customerId', ParseUUIDPipe) customerId: string, @CurrentUserId() userId: string) {
    await this.authorize(customerId, userId, 'read');
    return this.customers.listAddresses(customerId);
  }

  @Put(':customerId/addresses/:addressId')
  async updateAddress(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUserId() userId: string,
  ) {
    await this.authorize(customerId, userId, 'update');
    return this.customers.updateAddress(customerId, addressId, dto);
  }

  @Delete(':customerId/addresses/:addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAddress(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.authorize(customerId, userId, 'update');
    return this.customers.removeAddress(customerId, addressId);
  }

  @Get(':customerId/preferences')
  async getPreferences(@Param('customerId', ParseUUIDPipe) customerId: string, @CurrentUserId() userId: string) {
    await this.authorize(customerId, userId, 'read');
    return this.customers.getPreferences(customerId);
  }

  @Put(':customerId/preferences')
  async updatePreferences(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdatePreferencesDto,
    @CurrentUserId() userId: string,
  ) {
    await this.authorize(customerId, userId, 'update');
    return this.customers.updatePreferences(customerId, dto);
  }
}