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
} from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@ApiTags('policies')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  @ApiResponse({ status: 409, description: 'Policy name already exists' })
  create(@Body() dto: CreatePolicyDto) {
    return this.policiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all policies' })
  @ApiResponse({ status: 200, description: 'Returns all policies' })
  findAll() {
    return this.policiesService.findAll();
  }

  @Get(':policyId')
  @ApiOperation({ summary: 'Get a policy by ID' })
  @ApiParam({ name: 'policyId', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  findById(@Param('policyId') policyId: string) {
    return this.policiesService.findById(policyId);
  }

  @Put(':policyId')
  @ApiOperation({ summary: 'Update a policy (increments version)' })
  @ApiParam({ name: 'policyId', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  update(@Param('policyId') policyId: string, @Body() dto: UpdatePolicyDto) {
    return this.policiesService.update(policyId, dto);
  }

  @Delete(':policyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a policy' })
  @ApiParam({ name: 'policyId', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy deleted successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  remove(@Param('policyId') policyId: string) {
    return this.policiesService.remove(policyId);
  }
}
