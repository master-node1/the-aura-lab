import { Module } from '@nestjs/common';
import { InternalServiceGuard } from '../auth/internal-service.guard';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { InternalIdentityController } from './internal-identity.controller';
import { VerificationController } from './verification.controller';
import { VerificationNotifier } from './verification-notifier';
import { VerificationService } from './verification.service';

@Module({
  controllers: [VerificationController, InternalIdentityController, IdentityController],
  providers: [IdentityService, VerificationService, VerificationNotifier, InternalServiceGuard],
  exports: [IdentityService],
})
export class IdentityModule {}
