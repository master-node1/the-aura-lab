import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { IdentityClient } from '../src/identity/identity.client';
import { fakeConfig, jsonResponse } from './helpers';

const ID = '6f1c2b1e-8a43-4d5c-9b1e-2f3a4b5c6d7e';
const input = { id: ID, email: 'jane@example.com', displayName: 'jane', registrationSource: 'auth-service' };

describe('IdentityClient', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  const client = (token: string | null = 'internal-secret') =>
    new IdentityClient(fakeConfig({ INTERNAL_SERVICE_TOKEN: token ?? undefined, IDENTITY_SERVICE_URL: 'http://id:3001' }));

  it('creates identities through the internal API with the internal token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: ID }));
    await expect(client().create(input)).resolves.toEqual({ id: ID });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://id:3001/api/identity/internal/identities');
    expect(init.method).toBe('POST');
    expect(init.headers['x-internal-token']).toBe('internal-secret');
  });

  it('maps 409 on create to ConflictException', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409));
    await expect(client().create(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns null for an unknown identity', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404));
    await expect(client().findById(ID)).resolves.toBeNull();
    await expect(client().findByEmail('a+b@example.com')).resolves.toBeNull();
    expect(fetchMock.mock.calls[1][0]).toContain('by-email?email=a%2Bb%40example.com');
  });

  it.each([
    ['unreachable', () => fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))],
    ['returning 500', () => fetchMock.mockResolvedValue(jsonResponse(500))],
    ['rejecting the internal token', () => fetchMock.mockResolvedValue(jsonResponse(401))],
  ])('maps identity-service %s to 503', async (_case, arrange) => {
    arrange();
    await expect(client().findById(ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails with 503 without calling out when INTERNAL_SERVICE_TOKEN is not set', async () => {
    await expect(client(null).findById(ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats email verification requests as best effort', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503)).mockRejectedValueOnce(new Error('down'));
    await expect(client().requestEmailVerification(ID)).resolves.toBeUndefined();
    await expect(client().requestEmailVerification(ID)).resolves.toBeUndefined();
  });
});
