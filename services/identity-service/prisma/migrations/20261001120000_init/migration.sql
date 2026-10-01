-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'MOBILE');

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "mobile_number" TEXT,
    "status" "IdentityStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "profile_image" TEXT,
    "registration_source" TEXT,
    "last_login_at" TIMESTAMP(3),
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_mobile_verified" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_providers" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_audit_logs" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identities_email_key" ON "identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "identities_mobile_number_key" ON "identities"("mobile_number");

-- CreateIndex
CREATE INDEX "identity_verifications_identity_id_channel_created_at_idx" ON "identity_verifications"("identity_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "identity_verifications_code_hash_idx" ON "identity_verifications"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "identity_providers_provider_external_id_key" ON "identity_providers"("provider", "external_id");

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_audit_logs" ADD CONSTRAINT "identity_audit_logs_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

