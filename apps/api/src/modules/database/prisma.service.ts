import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { API_CONFIG, type ApiConfig } from '../../config/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(API_CONFIG) config: ApiConfig) {
    super({ datasources: { db: { url: config.DATABASE_URL } } });
  }
  async onModuleDestroy() { await this.$disconnect(); }
}
