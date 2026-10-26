import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/api-error.filter';
import type { ApiConfig } from './config/config';

export async function createApp(config: ApiConfig, silent = false) {
  const app = await NestFactory.create(AppModule.configure(config), silent ? { logger: false } : {});
  app.use((_: Request, response: Response, next: NextFunction) => {
    response.locals.requestId = randomUUID();
    response.setHeader('X-Request-Id', response.locals.requestId as string);
    next();
  });
  app.enableCors({ origin: config.CORS_ORIGINS, methods: ['GET', 'HEAD'], credentials: false });
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('SBG Coffee catalog API')
    .setDescription('Public catalog v1. Prices are current at fetchedAt; future order APIs must validate them on the server. Profile, orders and loyalty remain demo data in the app.')
    .setVersion('1.0.0')
    .build());
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
  return app;
}
