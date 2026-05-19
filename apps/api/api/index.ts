import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import type { IncomingMessage, ServerResponse } from 'http';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

let cachedApp: Express | null = null;

async function bootstrap(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    cors: false,
    logger: ['error', 'warn'],
  });

  app.use(cookieParser());

  const webOrigin = process.env.WEB_ORIGIN ?? 'https://aluno.liberdademedicaedu.com.br';
  app.enableCors({ origin: webOrigin, credentials: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  cachedApp = server;
  return server;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await bootstrap();
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
