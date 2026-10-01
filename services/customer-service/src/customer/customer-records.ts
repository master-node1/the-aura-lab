import { Prisma } from '@prisma/client';

export async function recordCustomerChange(
  transaction: Prisma.TransactionClient,
  customerId: string,
  action: string,
  eventType: string,
  details: Prisma.InputJsonObject = {},
): Promise<void> {
  await transaction.customerAuditLog.create({
    data: { customerId, action, details },
  });
  await transaction.customerEvent.create({
    data: {
      customerId,
      eventType,
      payload: { customerId, ...details },
    },
  });
}