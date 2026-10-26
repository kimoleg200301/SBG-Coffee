import { Module } from '@nestjs/common';
import { CatalogV2Controller } from './catalog-v2.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({ controllers: [CatalogController, CatalogV2Controller], providers: [CatalogService] })
export class CatalogModule {}
