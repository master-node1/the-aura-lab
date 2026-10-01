import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/authorization');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  });

  const config = new DocumentBuilder()
    .setTitle('Authorization Service')
    .setDescription(
      'Manages roles, permissions, policies and evaluates access decisions (RBAC + ABAC).',
    )
    .setVersion('1.0')
    .addBearerAuth()
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

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Authorization service running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/authorization/docs`);
}
bootstrap();
