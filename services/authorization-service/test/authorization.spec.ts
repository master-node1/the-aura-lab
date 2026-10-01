import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InternalServiceGuard } from '../src/auth/internal-service.guard';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RolesService } from '../src/roles/roles.service';
import { fakeConfig } from './helpers';

const IDENTITY = '6f1c2b1e-8a43-4d5c-9b1e-2f3a4b5c6d7e';

describe('InternalServiceGuard (global)', () => {
  const contextFor = (headers: Record<string, string>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) as unknown as Request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;
  const guard = (isPublic: boolean, token: string | null = 's3cret') =>
    new InternalServiceGuard(
      fakeConfig({ INTERNAL_SERVICE_TOKEN: token ?? undefined }),
      { getAllAndOverride: () => isPublic } as unknown as Reflector,
    );

  it('lets @Public() routes (health) through without a token', () => {
    expect(guard(true).canActivate(contextFor({}))).toBe(true);
  });

  it('requires the internal token everywhere else', () => {
    expect(guard(false).canActivate(contextFor({ 'x-internal-token': 's3cret' }))).toBe(true);
    expect(() => guard(false).canActivate(contextFor({}))).toThrow(UnauthorizedException);
    expect(() => guard(false).canActivate(contextFor({ 'x-internal-token': 'wrong' }))).toThrow(UnauthorizedException);
  });

  it('rejects everything except public routes when no token is configured', () => {
    expect(() => guard(false, null).canActivate(contextFor({ 'x-internal-token': 's3cret' }))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthorizationService.checkAccess', () => {
  const role = (name: string, permissions: Array<[string, string]>) => ({
    role: {
      name,
      rolePermissions: permissions.map(([resource, action]) => ({
        permission: { name: `${resource}.${action}`, resource, action },
      })),
    },
  });

  function setup(userRoles: unknown[]) {
    const prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue(userRoles) },
      authorizationAuditLog: { create: jest.fn() },
    };
    return { prisma, service: new AuthorizationService(prisma as unknown as PrismaService) };
  }
  const check = (service: AuthorizationService, resource: string, action: string) =>
    service.checkAccess({ identityId: IDENTITY, resource, action });

  it('denies by default when the identity has no roles, and audits the decision', async () => {
    const { prisma, service } = setup([]);
    await expect(check(service, 'customer', 'read')).resolves.toMatchObject({ allowed: false });
    expect(prisma.authorizationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ identityId: IDENTITY, decision: 'DENIED' }),
    });
  });

  it('grants an exact resource and action match', async () => {
    const { service } = setup([role('support', [['customer', 'read']])]);
    await expect(check(service, 'customer', 'read')).resolves.toMatchObject({ allowed: true });
    await expect(check(service, 'customer', 'update')).resolves.toMatchObject({ allowed: false });
    await expect(check(service, 'identity', 'read')).resolves.toMatchObject({ allowed: false });
  });

  it('lets the seeded admin wildcard (*/*) grant everything', async () => {
    const { prisma, service } = setup([role('admin', [['*', '*']])]);
    await expect(check(service, 'identity', 'suspend')).resolves.toMatchObject({
      allowed: true,
      reason: 'GRANTED: Permission "*.*" via role "admin"',
    });
    expect(prisma.authorizationAuditLog.create.mock.calls[0][0].data.decision).toBe('GRANTED');
  });

  it('supports per-resource action wildcards', async () => {
    const { service } = setup([role('customer_admin', [['customer', '*']])]);
    await expect(check(service, 'customer', 'manage')).resolves.toMatchObject({ allowed: true });
    await expect(check(service, 'identity', 'read')).resolves.toMatchObject({ allowed: false });
  });
});

describe('RolesService system roles', () => {
  const admin = { id: 'admin-id', name: 'admin', isSystem: true, rolePermissions: [] };
  const service = () => {
    const prisma = { role: { findUnique: jest.fn().mockResolvedValue(admin), update: jest.fn(), delete: jest.fn() } };
    return { prisma, roles: new RolesService(prisma as unknown as PrismaService) };
  };

  it('refuses to modify or delete the seeded admin role', async () => {
    const { prisma, roles } = service();
    await expect(roles.updateRole('admin-id', { name: 'pwned' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(roles.deleteRole('admin-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.role.update).not.toHaveBeenCalled();
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });
});
