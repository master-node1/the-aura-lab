import { Module } from '@nestjs/common';
import { DatabaseProviders } from 'src/providers/database.provider';

@Module({
  providers: [...DatabaseProviders],
})
export class DatabaseModule {}