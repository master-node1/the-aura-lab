import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { AccessControlService } from '../src/auth/access-control.service';
import { fakeConfig, jsonResponse } from './helpers';

const USER = '2b7f1d9c-1c3e-4b6a-9d2e-5f8a7c6b4d3e';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('AccessControlService', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const service = (token: string | null = 'internal-secret') =>
    new AccessControlService(
      fakeConfig({ INTERNAL_SERVICE_TOKEN: token ?? undefined, AUTHORIZATION_SERVICE_URL: 'http://authz:3002/' }),
    );

  it('lets the owner through without calling authorization-service', async () => {
    await expect(service().requireOwnerOrPermission(USER, USER, 'customer', 'read')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks authorization-service for anyone else, with the internal token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { allowed: true }));

    await service().requireOwnerOrPermission(USER, OTHER, 'customer', 'read');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://authz:3002/api/authorization/authorize');
    expect(init.headers['x-internal-token']).toBe('internal-secret');
    expect(JSON.parse(init.body)).toEqual({ identityId: USER, resource: 'customer', action: 'read' });
  });

  it('returns 403 when the permission is not granted', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { allowed: false }));
    await expect(service().requirePermission(USER, 'customer', 'manage')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats a 400 from authorization-service as a denial', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400));
    await expect(service().requirePermission(USER, 'customer', 'read')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['a 5xx response', () => fetchMock.mockResolvedValue(jsonResponse(500))],
    ['a 401 (wrong internal token)', () => fetchMock.mockResolvedValue(jsonResponse(401))],
    ['a network error or timeout', () => fetchMock.mockRejectedValue(new Error('timeout'))],
  ])('fails closed with 503 on %s', async (_case, arrange) => {
    arrange();
    await expect(service().requirePermission(USER, 'customer', 'read')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed with 503 when INTERNAL_SERVICE_TOKEN is not configured', async () => {
    await expect(service(null).requirePermission(USER, 'customer', 'read')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only accepts allowed === true', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { allowed: 'yes' }));
    await expect(service().requirePermission(USER, 'customer', 'read')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
