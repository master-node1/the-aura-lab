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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@ApiTags('roles')
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('health')
  @ApiOperation({ summary: 'Service health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return { status: 'ok', service: 'authorization-service' };
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 409, description: 'Role name already exists' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List all roles' })
  @ApiResponse({ status: 200, description: 'Returns all roles with permissions' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('roles/:roleId')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role details with permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  findById(@Param('roleId') roleId: string) {
    return this.rolesService.findById(roleId);
  }

  @Put('roles/:roleId')
  @ApiOperation({ summary: 'Update a role' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot modify system role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  updateRole(@Param('roleId') roleId: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(roleId, dto);
  }

  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete system role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  deleteRole(@Param('roleId') roleId: string) {
    return this.rolesService.deleteRole(roleId);
  }

  @Post('roles/:roleId/permissions/:permissionId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a permission to a role' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  @ApiResponse({ status: 201, description: 'Permission assigned to role' })
  @ApiResponse({ status: 409, description: 'Permission already assigned to role' })
  assignPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.assignPermission(roleId, permissionId);
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a permission from a role' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  @ApiResponse({ status: 200, description: 'Permission revoked from role' })
  @ApiResponse({ status: 404, description: 'Role or permission assignment not found' })
  revokePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.revokePermission(roleId, permissionId);
  }

  @Post('roles/:roleId/assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a role to an identity' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 201, description: 'Role assigned to identity' })
  @ApiResponse({ status: 409, description: 'Role already assigned to this identity' })
  assignRoleToUser(
    @Param('roleId') roleId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignRoleToUser(roleId, dto);
  }

  @Delete('roles/:roleId/users/:identityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a role from an identity' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiParam({ name: 'identityId', description: 'Identity UUID' })
  @ApiResponse({ status: 200, description: 'Role revoked from identity' })
  @ApiResponse({ status: 404, description: 'Role assignment not found' })
  revokeRoleFromUser(
    @Param('roleId') roleId: string,
    @Param('identityId') identityId: string,
  ) {
    return this.rolesService.revokeRoleFromUser(roleId, identityId);
  }
}
