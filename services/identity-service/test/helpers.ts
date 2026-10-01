import { ConfigService } from '@nestjs/config';

/** ConfigService stand-in that reads only the given values (ignores process.env). */
export function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) => (values[key] ?? fallback) as T,
  } as unknown as ConfigService;
}

/** Minimal fetch Response for mocking global fetch. */
export function jsonResponse(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}
