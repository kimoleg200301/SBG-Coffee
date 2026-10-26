import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { apiErrorSchema } from '@sbg/contracts';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { openApiSchema } from './openapi';

export const errorResponseOptions = { schema: openApiSchema(apiErrorSchema) };

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = String(response.locals.requestId ?? randomUUID());
    let status = 500;
    let message = 'An unexpected error occurred';
    let code = 'INTERNAL_ERROR';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      code = ({ 400: 'BAD_REQUEST', 404: 'NOT_FOUND', 503: 'DATABASE_UNAVAILABLE' } as Record<number, string>)[status] ?? 'HTTP_ERROR';
    } else if (exception instanceof Prisma.PrismaClientInitializationError ||
      (exception instanceof Prisma.PrismaClientKnownRequestError && ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(exception.code))) {
      status = 503;
      message = 'Database is temporarily unavailable';
      code = 'DATABASE_UNAVAILABLE';
    }
    if (status >= 500) {
      // Never log Prisma messages containing connection strings or query data.
      this.logger.error(`${requestId} ${code}`);
    }
    response.setHeader('X-Request-Id', requestId);
    response.status(status).json({ error: { code, message, requestId } });
  }
}
