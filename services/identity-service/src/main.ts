import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/identity');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'] });

  const config = new DocumentBuilder()
    .setTitle('Identity Service')
    .setDescription('Central authority for managing digital identities — who a user IS throughout their lifecycle.')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('identity')
    .build();
  SwaggerModule.setup('api/identity/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Identity service running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/identity/docs`);
}
bootstrap();
