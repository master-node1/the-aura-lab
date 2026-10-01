-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "identity_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("identity_id","role_id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_audit_logs" (
    "id" UUID NOT NULL,
    "identity_id" TEXT,
    "resource" TEXT,
    "action" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorization_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "policies_name_key" ON "policies"("name");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed: permission catalog used by identity-service and customer-service.
-- Fixed IDs keep the seed idempotent and easy to reference.
INSERT INTO "permissions" ("id", "name", "resource", "action", "description") VALUES
    ('00000000-0000-4000-8000-000000000001', '*', '*', '*', 'Every action on every resource'),
    ('00000000-0000-4000-8000-000000000101', 'identity.read', 'identity', 'read', 'Read any identity'),
    ('00000000-0000-4000-8000-000000000102', 'identity.update', 'identity', 'update', 'Update any identity and its providers'),
    ('00000000-0000-4000-8000-000000000103', 'identity.delete', 'identity', 'delete', 'Soft-delete any identity'),
    ('00000000-0000-4000-8000-000000000104', 'identity.suspend', 'identity', 'suspend', 'Suspend or reactivate any identity'),
    ('00000000-0000-4000-8000-000000000105', 'identity.audit', 'identity', 'audit', 'Read any identity audit log'),
    ('00000000-0000-4000-8000-000000000201', 'customer.create', 'customer', 'create', 'Create a customer for any identity'),
    ('00000000-0000-4000-8000-000000000202', 'customer.read', 'customer', 'read', 'Search and read any customer'),
    ('00000000-0000-4000-8000-000000000203', 'customer.update', 'customer', 'update', 'Update any customer, its addresses and preferences'),
    ('00000000-0000-4000-8000-000000000204', 'customer.delete', 'customer', 'delete', 'Soft-delete any customer'),
    ('00000000-0000-4000-8000-000000000205', 'customer.manage', 'customer', 'manage', 'Change any customer status');

-- Seed: the admin system role holds the wildcard permission. System roles can't be
-- changed or deleted through the API. Assign it with `node dist/cli/assign-role.js`.
INSERT INTO "roles" ("id", "name", "description", "is_system", "updated_at") VALUES
    ('00000000-0000-4000-9000-000000000001', 'admin', 'Full access to every resource', true, CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES
    ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001');
