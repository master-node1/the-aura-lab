import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckAccessDto } from './dto/check-access.dto';

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  identityId: string;
  resource: string;
  action: string;
}

export interface PolicyRule {
  effect: 'allow' | 'deny';
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * RBAC check: load user's roles → load permissions →
   * check if resource+action matches. Deny-by-default.
   * Logs decision to AuthorizationAuditLog.
   */
  async checkAccess(dto: CheckAccessDto): Promise<AccessDecision> {
    const { identityId, resource, action, context } = dto;

    // Load all roles assigned to this identity with their permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: { identityId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    let allowed = false;
    let reason = 'DENIED: No matching permission found for the requested resource and action';

    if (userRoles.length === 0) {
      reason = 'DENIED: Identity has no roles assigned';
    } else {
      // Check each role's permissions for a match
      for (const userRole of userRoles) {
        for (const rp of userRole.role.rolePermissions) {
          const perm = rp.permission;
          // Wildcard '*' matches any resource or action
          if (
            (perm.resource === resource || perm.resource === '*') &&
            (perm.action === action || perm.action === '*')
          ) {
            allowed = true;
            reason = `GRANTED: Permission "${perm.name}" via role "${userRole.role.name}"`;
            break;
          }
        }
        if (allowed) break;
      }
    }

    // Log the decision
    await this.prisma.authorizationAuditLog.create({
      data: {
        identityId,
        resource,
        action,
        decision: allowed ? 'GRANTED' : 'DENIED',
        reason,
        context: context ?? {},
      },
    });

    return { allowed, reason, identityId, resource, action };
  }

  /**
   * Evaluate a named policy against a context object.
   * Rules are evaluated in order; first matching rule wins.
   * Deny-by-default if no rule matches.
   */
  async evaluatePolicy(
    policyId: string,
    context: Record<string, unknown>,
  ): Promise<{ matched: boolean; effect: string; reason: string }> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
    });
    if (!policy) {
      throw new NotFoundException(`Policy with ID "${policyId}" not found`);
    }
    if (!policy.isActive) {
      return {
        matched: false,
        effect: 'deny',
        reason: `Policy "${policy.name}" is inactive`,
      };
    }

    const rules = (policy.rules as PolicyRule[]) ?? [];
    const resource = String(context['resource'] ?? '');
    const action = String(context['action'] ?? '');

    for (const rule of rules) {
      const resourceMatch =
        rule.resource === '*' || rule.resource === resource;
      const actionMatch =
        rule.action === '*' || rule.action === action;

      if (resourceMatch && actionMatch) {
        return {
          matched: true,
          effect: rule.effect,
          reason: `Policy "${policy.name}" rule matched: effect=${rule.effect}`,
        };
      }
    }

    return {
      matched: false,
      effect: 'deny',
      reason: `Policy "${policy.name}" has no matching rule — deny by default`,
    };
  }

  /**
   * Returns all distinct permissions for an identity via their assigned roles.
   */
  async getUserPermissions(identityId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { identityId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (userRoles.length === 0) {
      return {
        identityId,
        roles: [],
        permissions: [],
      };
    }

    // Deduplicate permissions by ID
    const permissionMap = new Map<
      string,
      { id: string; name: string; resource: string; action: string; description: string | null }
    >();

    const roles: { id: string; name: string }[] = [];

    for (const userRole of userRoles) {
      roles.push({ id: userRole.role.id, name: userRole.role.name });
      for (const rp of userRole.role.rolePermissions) {
        const perm = rp.permission;
        if (!permissionMap.has(perm.id)) {
          permissionMap.set(perm.id, {
            id: perm.id,
            name: perm.name,
            resource: perm.resource,
            action: perm.action,
            description: perm.description,
          });
        }
      }
    }

    return {
      identityId,
      roles,
      permissions: Array.from(permissionMap.values()),
    };
  }
}
