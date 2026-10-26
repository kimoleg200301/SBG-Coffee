import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponseDto } from '@sbg/contracts';
import { openApiSchema } from '../../common/openapi';
import { errorResponseOptions } from '../../common/api-error.filter';
import { PrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Readiness: HTTP process and PostgreSQL connection' })
  @ApiOkResponse({ schema: openApiSchema(healthResponseSchema) })
  @ApiServiceUnavailableResponse(errorResponseOptions)
  async readiness(): Promise<HealthResponseDto> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Readiness timeout')), 2500);
        }),
      ]);
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database is temporarily unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
