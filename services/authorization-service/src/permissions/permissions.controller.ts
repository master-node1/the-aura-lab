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
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Permission name or resource+action combination already exists',
  })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all permissions' })
  @ApiResponse({ status: 200, description: 'Returns all permissions' })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':permissionId')
  @ApiOperation({ summary: 'Get a permission by ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  @ApiResponse({ status: 200, description: 'Permission details' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  findById(@Param('permissionId') permissionId: string) {
    return this.permissionsService.findById(permissionId);
  }

  @Put(':permissionId')
  @ApiOperation({ summary: 'Update a permission' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  @ApiResponse({ status: 200, description: 'Permission updated successfully' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 409, description: 'Conflicting name or resource+action' })
  update(
    @Param('permissionId') permissionId: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(permissionId, dto);
  }

  @Delete(':permissionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  @ApiResponse({ status: 200, description: 'Permission deleted successfully' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  remove(@Param('permissionId') permissionId: string) {
    return this.permissionsService.remove(permissionId);
  }
}
