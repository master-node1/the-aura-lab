import {
  Controller,
  Get,
  Post,
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
import { AuthorizationService } from './authorization.service';
import { CheckAccessDto } from './dto/check-access.dto';

@ApiTags('authorization')
@Controller()
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if an identity is allowed to perform an action on a resource',
    description:
      'Performs an RBAC evaluation. Returns allowed=true if any role assigned to the identity ' +
      'grants the requested resource+action. Deny-by-default.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the access decision',
    schema: {
      example: {
        allowed: true,
        reason: 'GRANTED: Permission "product.create" via role "catalog_manager"',
        identityId: '550e8400-e29b-41d4-a716-446655440000',
        resource: 'product',
        action: 'create',
      },
    },
  })
  checkAccess(@Body() dto: CheckAccessDto) {
    return this.authorizationService.checkAccess(dto);
  }

  @Post('check-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Alias for POST /authorize — check access decision',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the access decision',
  })
  checkAccessAlias(@Body() dto: CheckAccessDto) {
    return this.authorizationService.checkAccess(dto);
  }

  @Get('users/:identityId/permissions')
  @ApiOperation({
    summary: 'Get all permissions for an identity',
    description:
      'Returns all permissions granted to an identity via their assigned roles, deduplicated.',
  })
  @ApiParam({ name: 'identityId', description: 'Identity UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns roles and permissions for the identity',
    schema: {
      example: {
        identityId: '550e8400-e29b-41d4-a716-446655440000',
        roles: [{ id: 'uuid', name: 'catalog_manager' }],
        permissions: [
          { id: 'uuid', name: 'product.create', resource: 'product', action: 'create' },
        ],
      },
    },
  })
  getUserPermissions(@Param('identityId') identityId: string) {
    return this.authorizationService.getUserPermissions(identityId);
  }
}
