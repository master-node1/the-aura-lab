import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { USER_ID_HEADER } from './auth/jwt.strategy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.setGlobalPrefix('api/customer');
  // x-user-id is only trusted when the JWT guard sets it; drop any client-supplied value.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    delete req.headers[USER_ID_HEADER];
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Customer Service')
      .setDescription('Customer profiles, addresses, preferences, and lifecycle management.')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('customers')
      .build();
    SwaggerModule.setup(
      'api/customer/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Customer service running on port ${port}`);
}

void bootstrap();
