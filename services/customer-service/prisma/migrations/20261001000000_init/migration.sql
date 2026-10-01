CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'SUSPENDED', 'DELETED');
CREATE TYPE "AddressType" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');

CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identity_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "mobile_number" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "preferred_currency" TEXT NOT NULL DEFAULT 'USD',
    "profile_picture" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "mobile_verified" BOOLEAN NOT NULL DEFAULT false,
    "registration_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "recipient_name" TEXT NOT NULL,
    "phone" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'SHIPPING',
    "is_default_shipping" BOOLEAN NOT NULL DEFAULT false,
    "is_default_billing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "email_marketing" BOOLEAN NOT NULL DEFAULT false,
    "sms_marketing" BOOLEAN NOT NULL DEFAULT false,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "order_notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "customer_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_identity_id_key" ON "customers"("identity_id");
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
CREATE UNIQUE INDEX "customers_mobile_number_key" ON "customers"("mobile_number");
CREATE INDEX "customers_status_deleted_at_idx" ON "customers"("status", "deleted_at");
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");
CREATE UNIQUE INDEX "customer_addresses_one_default_shipping" ON "customer_addresses"("customer_id") WHERE "is_default_shipping" = true;
CREATE UNIQUE INDEX "customer_addresses_one_default_billing" ON "customer_addresses"("customer_id") WHERE "is_default_billing" = true;
CREATE UNIQUE INDEX "customer_preferences_customer_id_key" ON "customer_preferences"("customer_id");
CREATE INDEX "customer_audit_logs_customer_id_created_at_idx" ON "customer_audit_logs"("customer_id", "created_at");
CREATE INDEX "customer_events_published_at_created_at_idx" ON "customer_events"("published_at", "created_at");

ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_audit_logs" ADD CONSTRAINT "customer_audit_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;