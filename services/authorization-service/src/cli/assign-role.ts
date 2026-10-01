/**
 * Assigns a role to an identity directly in the database. Used to bootstrap the first
 * admin, since every API call that grants roles already requires an existing admin.
 *
 *   node dist/cli/assign-role.js <identityId> [roleName=admin]
 */
import { PrismaClient } from '@prisma/client';
import { isUUID } from 'class-validator';

async function main() {
  const [identityId, roleName = 'admin'] = process.argv.slice(2);
  if (!identityId || !isUUID(identityId)) {
    console.error('Usage: node dist/cli/assign-role.js <identityId> [roleName=admin]');
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.error(`Role "${roleName}" not found`);
      process.exitCode = 1;
      return;
    }
    await prisma.userRole.upsert({
      where: { identityId_roleId: { identityId, roleId: role.id } },
      create: { identityId, roleId: role.id, assignedBy: 'cli' },
      update: {},
    });
    console.log(`Role "${roleName}" assigned to identity ${identityId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Failed to assign role: ${(error as Error).message}`);
  process.exitCode = 1;
});
