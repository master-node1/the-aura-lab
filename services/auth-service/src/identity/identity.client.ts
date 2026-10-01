import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const INTERNAL_TOKEN_HEADER = 'x-internal-token';
const REQUEST_TIMEOUT_MS = 3000;

export interface IdentityRecord {
  id: string;
  email: string;
  status: string;
  isEmailVerified: boolean;
  deletedAt: string | null;
}

export interface CreateIdentityInput {
  id: string;
  email: string;
  displayName: string;
  registrationSource: string;
}

/** Calls identity-service's internal API (/api/identity/internal/*) on the backend network. */
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);
  private readonly baseUrl: string;
  private readonly internalToken?: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('IDENTITY_SERVICE_URL', 'http://identity-service:3001');
    this.baseUrl = `${url.replace(/\/$/, '')}/api/identity/internal/identities`;
    this.internalToken = config.get<string>('INTERNAL_SERVICE_TOKEN');
  }

  /** Creates the identity. Throws ConflictException if the email or ID already exists. */
  async create(input: CreateIdentityInput): Promise<IdentityRecord> {
    const response = await this.request('POST', '', input);
    if (response.status === 409) throw new ConflictException('Email already registered');
    return this.json<IdentityRecord>(response, 201);
  }

  async findById(id: string): Promise<IdentityRecord | null> {
    const response = await this.request('GET', `/${id}`);
    if (response.status === 404) return null;
    return this.json<IdentityRecord>(response, 200);
  }

  async findByEmail(email: string): Promise<IdentityRecord | null> {
    const response = await this.request('GET', `/by-email?email=${encodeURIComponent(email)}`);
    if (response.status === 404) return null;
    return this.json<IdentityRecord>(response, 200);
  }

  /**
   * Asks identity-service to issue and send an email verification code. Best effort:
   * failures (including 503 while no email provider is configured) are logged, not thrown.
   */
  async requestEmailVerification(id: string): Promise<void> {
    try {
      const response = await this.request('POST', `/${id}/verifications`, { channel: 'email' });
      if (response.status !== 201 && response.status !== 409) {
        this.logger.warn(`Email verification for identity ${id} not issued: HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Email verification for identity ${id} not issued: ${(error as Error).message}`);
    }
  }

  private async request(method: string, path: string, body?: unknown): Promise<globalThis.Response> {
    if (!this.internalToken) {
      this.logger.error('INTERNAL_SERVICE_TOKEN is not set; cannot call identity-service');
      throw new ServiceUnavailableException('Identity service unavailable');
    }
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', [INTERNAL_TOKEN_HEADER]: this.internalToken },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`identity-service unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Identity service unavailable');
    }
  }

  private async json<T>(response: globalThis.Response, expectedStatus: number): Promise<T> {
    if (response.status !== expectedStatus) {
      this.logger.warn(`identity-service returned HTTP ${response.status}`);
      throw new ServiceUnavailableException('Identity service unavailable');
    }
    return (await response.json()) as T;
  }
}
