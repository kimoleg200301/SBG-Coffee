import { BadRequestException, Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { catalogRequestQuerySchema, catalogV2ResponseSchema } from '@sbg/contracts';
import { openApiSchema } from '../../common/openapi';
import { CatalogService } from './catalog.service';
import { errorResponseOptions } from '../../common/api-error.filter';

@ApiTags('catalog')
@Controller('api/v2/catalog')
export class CatalogV2Controller {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}
  @Get('products')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read available drinks, desserts and additions with current prices in KZT' })
  @ApiOkResponse({ schema: openApiSchema(catalogV2ResponseSchema) })
  @ApiBadRequestResponse(errorResponseOptions)
  @ApiServiceUnavailableResponse(errorResponseOptions)
  list(@Query() query: Record<string, unknown>) {
    if (!catalogRequestQuerySchema.safeParse(query).success) {
      throw new BadRequestException('This endpoint does not support query parameters');
    }
    return this.catalog.listV2();
  }
}
