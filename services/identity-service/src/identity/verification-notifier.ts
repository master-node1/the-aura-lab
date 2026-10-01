import { Injectable, Logger } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';

/**
 * Delivers verification codes. No email/SMS provider exists yet, so this stub only
 * logs a masked destination (never the code). Replace `send` and return true from
 * `isConfigured` once a notification service is available.
 */
@Injectable()
export class VerificationNotifier {
  private readonly logger = new Logger(VerificationNotifier.name);

  isConfigured(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a real sender delivers the code
  async send(channel: VerificationChannel, destination: string, _code: string): Promise<void> {
    this.logger.warn(
      `No ${channel.toLowerCase()} delivery configured; code for ${mask(destination)} was not sent`,
    );
  }
}

function mask(destination: string): string {
  const at = destination.indexOf('@');
  if (at > 0) return `${destination[0]}***${destination.slice(at)}`;
  return `***${destination.slice(-4)}`;
}
