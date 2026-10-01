import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerStatus } from '@prisma/client';
import { AccessControlService } from '../src/auth/access-control.service';
import { CustomerController } from '../src/customer/customer.controller';
import { CustomerService } from '../src/customer/customer.service';

const OWNER = '2b7f1d9c-1c3e-4b6a-9d2e-5f8a7c6b4d3e';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CUSTOMER = 'c0ffee00-1234-4abc-8def-0123456789ab';
const ADDRESS = 'add0e550-1234-4abc-8def-0123456789ab';

function setup() {
  const customers = {
    findOwnerIdentityId: jest.fn().mockResolvedValue(OWNER),
    create: jest.fn().mockResolvedValue({ id: CUSTOMER }),
    search: jest.fn().mockResolvedValue({ data: [] }),
    findById: jest.fn().mockResolvedValue({ id: CUSTOMER }),
    update: jest.fn(),
    remove: jest.fn(),
    updateStatus: jest.fn(),
    createAddress: jest.fn(),
    listAddresses: jest.fn(),
    updateAddress: jest.fn(),
    removeAddress: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    findProfile: jest.fn(),
  };
  const access = { requireOwnerOrPermission: jest.fn(), requirePermission: jest.fn() };
  const controller = new CustomerController(
    customers as unknown as CustomerService,
    access as unknown as AccessControlService,
  );
  return { customers, access, controller };
}

describe('CustomerController access rules', () => {
  const address = { recipientName: 'A', line1: '1 St', city: 'SF', postalCode: '94105', country: 'US' };

  it.each([
    ['GET /customers/:id', 'read', (c: CustomerController) => c.getById(CUSTOMER, OTHER)],
    ['PUT /customers/:id', 'update', (c: CustomerController) => c.update(CUSTOMER, {}, OTHER)],
    ['DELETE /customers/:id', 'delete', (c: CustomerController) => c.remove(CUSTOMER, OTHER)],
    ['POST addresses', 'update', (c: CustomerController) => c.createAddress(CUSTOMER, address, OTHER)],
    ['GET addresses', 'read', (c: CustomerController) => c.listAddresses(CUSTOMER, OTHER)],
    ['PUT addresses/:id', 'update', (c: CustomerController) => c.updateAddress(CUSTOMER, ADDRESS, {}, OTHER)],
    ['DELETE addresses/:id', 'update', (c: CustomerController) => c.removeAddress(CUSTOMER, ADDRESS, OTHER)],
    ['GET preferences', 'read', (c: CustomerController) => c.getPreferences(CUSTOMER, OTHER)],
    ['PUT preferences', 'update', (c: CustomerController) => c.updatePreferences(CUSTOMER, {}, OTHER)],
  ])('%s checks the owner, then customer:%s', async (_route, action, call) => {
    const { customers, access, controller } = setup();
    await call(controller);
    expect(customers.findOwnerIdentityId).toHaveBeenCalledWith(CUSTOMER);
    expect(access.requireOwnerOrPermission).toHaveBeenCalledWith(OTHER, OWNER, 'customer', action);
  });

  it('POST /customers treats the identityId in the body as the owner', async () => {
    const { access, controller } = setup();
    await controller.create({ identityId: OWNER, email: 'a@b.c', firstName: 'A', lastName: 'B' }, OTHER);
    expect(access.requireOwnerOrPermission).toHaveBeenCalledWith(OTHER, OWNER, 'customer', 'create');
  });

  it('GET /customers (search) is permission-only', async () => {
    const { access, controller } = setup();
    await controller.search({ page: 1, pageSize: 25 }, OWNER);
    expect(access.requirePermission).toHaveBeenCalledWith(OWNER, 'customer', 'read');
    expect(access.requireOwnerOrPermission).not.toHaveBeenCalled();
  });

  it('PATCH status is permission-only, even for the owner', async () => {
    const { access, controller } = setup();
    await controller.updateStatus(CUSTOMER, { status: CustomerStatus.SUSPENDED }, OWNER);
    expect(access.requirePermission).toHaveBeenCalledWith(OWNER, 'customer', 'manage');
  });

  it('does not call the service when access is denied', async () => {
    const { customers, access, controller } = setup();
    access.requireOwnerOrPermission.mockRejectedValue(new ForbiddenException());
    await expect(controller.remove(CUSTOMER, OTHER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(customers.remove).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing customer before checking permissions', async () => {
    const { customers, access, controller } = setup();
    customers.findOwnerIdentityId.mockRejectedValue(new NotFoundException());
    await expect(controller.getById(CUSTOMER, OTHER)).rejects.toBeInstanceOf(NotFoundException);
    expect(access.requireOwnerOrPermission).not.toHaveBeenCalled();
  });

  it('/customers/profile uses the JWT user ID with no permission check', async () => {
    const { customers, access, controller } = setup();
    await controller.getProfile(OWNER);
    expect(customers.findProfile).toHaveBeenCalledWith(OWNER);
    expect(access.requireOwnerOrPermission).not.toHaveBeenCalled();
    expect(access.requirePermission).not.toHaveBeenCalled();
  });
});
