import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_TOKEN_HEADER } from './internal-service.guard';

const AUTHORIZE_TIMEOUT_MS = 2000;

/**
 * Owner-or-permission checks. Owners act on their own records; anyone else needs a
 * permission granted through authorization-service. If authorization-service can't
 * answer, the request is refused with 503 (fail closed), never allowed.
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);
  private readonly authorizeUrl: string;
  private readonly internalToken?: string;

  constructor(config: ConfigService) {
    const baseUrl = config.get<string>('AUTHORIZATION_SERVICE_URL', 'http://authorization-service:3002');
    this.authorizeUrl = `${baseUrl.replace(/\/$/, '')}/api/authorization/authorize`;
    this.internalToken = config.get<string>('INTERNAL_SERVICE_TOKEN');
  }

  async requireOwnerOrPermission(
    userId: string,
    ownerId: string | null | undefined,
    resource: string,
    action: string,
  ): Promise<void> {
    if (ownerId && ownerId === userId) return;
    await this.requirePermission(userId, resource, action);
  }

  async requirePermission(userId: string, resource: string, action: string): Promise<void> {
    if (!(await this.isAllowed(userId, resource, action))) {
      throw new ForbiddenException(`Missing permission ${resource}:${action}`);
    }
  }

  private async isAllowed(identityId: string, resource: string, action: string): Promise<boolean> {
    if (!this.internalToken) {
      this.logger.error('INTERNAL_SERVICE_TOKEN is not set; cannot call authorization-service');
      throw new ServiceUnavailableException('Authorization service unavailable');
    }
    let response: Response;
    try {
      response = await fetch(this.authorizeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INTERNAL_TOKEN_HEADER]: this.internalToken },
        body: JSON.stringify({ identityId, resource, action }),
        signal: AbortSignal.timeout(AUTHORIZE_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`authorization-service unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Authorization service unavailable');
    }
    if (response.status === 400) {
      // The request can't be evaluated (e.g. the user ID isn't a valid UUID): deny it.
      this.logger.warn('authorization-service rejected the access check as invalid; denying');
      return false;
    }
    if (!response.ok) {
      this.logger.warn(`authorization-service returned HTTP ${response.status}`);
      throw new ServiceUnavailableException('Authorization service unavailable');
    }
    const decision = (await response.json()) as { allowed?: unknown };
    return decision.allowed === true;
  }
}
