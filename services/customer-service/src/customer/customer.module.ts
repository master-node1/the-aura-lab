import { Module } from '@nestjs/common';
import { AccessControlService } from '../auth/access-control.service';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({ controllers: [CustomerController], providers: [CustomerService, AccessControlService] })
export class CustomerModule {}