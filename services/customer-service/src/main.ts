import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/customer');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  });

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Customer service running on port ${port}`);
}

void bootstrap();