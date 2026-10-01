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
  ApiHeader,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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
@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a customer profile linked to an identity' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search customers' })
  search(@Query() query: CustomerSearchQuery) {
    return this.customers.search(query);
  }

  @Get('profile')
  @ApiHeader({ name: 'x-identity-id', required: true })
  @ApiOperation({ summary: 'Get the profile for the authenticated identity' })
  getProfile(@Headers('x-identity-id') identityId: string) {
    return this.customers.findProfile(identityId);
  }

  @Put('profile')
  @ApiHeader({ name: 'x-identity-id', required: true })
  @ApiOperation({ summary: 'Update the profile for the authenticated identity' })
  updateProfile(
    @Headers('x-identity-id') identityId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.updateProfile(identityId, dto);
  }

  @Get(':customerId')
  getById(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.customers.findById(customerId);
  }

  @Put(':customerId')
  update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(customerId, dto);
  }

  @Delete(':customerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Customer was soft-deleted' })
  remove(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.customers.remove(customerId);
  }

  @Patch(':customerId/status')
  updateStatus(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    return this.customers.updateStatus(customerId, dto);
  }

  @Post(':customerId/addresses')
  createAddress(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.customers.createAddress(customerId, dto);
  }

  @Get(':customerId/addresses')
  listAddresses(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.customers.listAddresses(customerId);
  }

  @Put(':customerId/addresses/:addressId')
  updateAddress(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customers.updateAddress(customerId, addressId, dto);
  }

  @Delete(':customerId/addresses/:addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddress(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.customers.removeAddress(customerId, addressId);
  }

  @Get(':customerId/preferences')
  getPreferences(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.customers.getPreferences(customerId);
  }

  @Put(':customerId/preferences')
  updatePreferences(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.customers.updatePreferences(customerId, dto);
  }
}