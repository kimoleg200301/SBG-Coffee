import { Global, Module, type DynamicModule } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from './config/config';
import { DatabaseModule } from './modules/database/database.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';

@Global()
@Module({})
class ConfigurationModule {
  static configure(config: ApiConfig): DynamicModule {
    return { module: ConfigurationModule, providers: [{ provide: API_CONFIG, useValue: config }], exports: [API_CONFIG] };
  }
}
@Module({})
export class AppModule {
  static configure(config: ApiConfig): DynamicModule {
    return { module: AppModule, imports: [ConfigurationModule.configure(config), DatabaseModule, CatalogModule, HealthModule] };
  }
}
