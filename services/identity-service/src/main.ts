import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { USER_ID_HEADER } from './auth/jwt.strategy';
import { INTERNAL_TOKEN_HEADER } from './auth/internal-service.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.setGlobalPrefix('api/identity');
  // x-user-id is only trusted when the JWT guard sets it; drop any client-supplied value.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    delete req.headers[USER_ID_HEADER];
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'] });

  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    logger.warn('INTERNAL_SERVICE_TOKEN is not set; /internal endpoints will reject every request');
  }

  const port = process.env.PORT ?? 3001;
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Identity Service')
      .setDescription('Central authority for managing digital identities — who a user IS throughout their lifecycle.')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: INTERNAL_TOKEN_HEADER }, 'internal')
      .addTag('identity')
      .build();
    SwaggerModule.setup('api/identity/docs', app, SwaggerModule.createDocument(app, config));
    logger.log(`Swagger docs: http://localhost:${port}/api/identity/docs`);
  }

  await app.listen(port);
  logger.log(`Identity service running on port ${port}`);
}
bootstrap();
