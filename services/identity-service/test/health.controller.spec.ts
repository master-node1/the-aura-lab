import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HealthController', () => {
  const controllerWith = (queryRaw: jest.Mock) =>
    new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

  it('reports ok when the database answers', async () => {
    await expect(controllerWith(jest.fn().mockResolvedValue([1])).health()).resolves.toEqual({
      status: 'ok',
      service: 'identity-service',
      checks: { database: 'up' },
    });
  });

  it('returns 503 with the database marked down when the query fails', async () => {
    const error = await controllerWith(jest.fn().mockRejectedValue(new Error('connection refused')))
      .health()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      service: 'identity-service',
      checks: { database: 'down' },
    });
  });

  it('returns 503 when the database does not answer within 2 seconds', async () => {
    jest.useFakeTimers();
    try {
      const pending = controllerWith(jest.fn(() => new Promise(() => undefined))).health();
      jest.advanceTimersByTime(2000);
      await expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      jest.useRealTimers();
    }
  });
});
