import { Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from 'src/controller/auth.controller';
import { AuthService } from 'src/service/auth.service';
import { DatabaseModule } from './database.module';
import { TransformUtils } from '../utils/transform.util;
import { Credentials, CredentialsSchema } from '../model/credentials.model';

@Module({
    imports: [
        DatabaseModule,
        MongooseModule.forFeature([
            { name: Credentials.name, schema: CredentialsSchema },
        ])
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        Logger,
        TransformUtils
    ],
})
export class AppModule implements OnModuleDestroy {
    constructor(
    ) { }
}
