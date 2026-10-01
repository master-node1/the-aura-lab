import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { INTERNAL_TOKEN_HEADER } from './auth/internal-service.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/authorization');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  });

  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    console.warn('INTERNAL_SERVICE_TOKEN is not set; every request except /health will be rejected');
  }

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Authorization Service')
      .setDescription(
        'Manages roles, permissions, policies and evaluates access decisions (RBAC + ABAC).',
      )
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: INTERNAL_TOKEN_HEADER }, 'internal')
      .addSecurityRequirements('internal')
      .addTag('roles')
      .addTag('permissions')
      .addTag('policies')
      .addTag('authorization')
      .build();
    SwaggerModule.setup(
      'api/authorization/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Authorization service running on port ${port}`);
  if (process.env.NODE_ENV !== 'production') console.log(`Swagger docs: http://localhost:${port}/api/authorization/docs`);
}
bootstrap();
