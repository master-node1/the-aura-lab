import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }) // enable internal fastify logger
  );

  // Register security plugins
  await app.register(fastifyHelmet);
  await app.register(fastifyCompress);
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'supersecret', // for signed cookies
  });

  // CORS
  app.enableCors({
    origin: ['http://localhost:3000'], // update as required
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Global prefix (optional)
  app.setGlobalPrefix('api/v1');

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Fastify server running on http://localhost:${port}`);
}
bootstrap();
