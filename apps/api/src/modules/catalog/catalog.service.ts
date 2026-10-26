import { Inject, Injectable } from '@nestjs/common';
import { catalogResponseSchema, type CatalogResponseDto } from '@sbg/contracts';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(): Promise<CatalogResponseDto> {
    const products = await this.prisma.product.findMany({
      where: { available: true, variants: { some: { available: true } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        variants: {
          where: { available: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });
    // Explicit mapping keeps Prisma models/internal fields out of the wire contract.
    return catalogResponseSchema.parse({
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        image: product.image,
        ...(product.tag === null ? {} : { tag: product.tag }),
        variants: product.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          volumeMl: variant.volumeMl,
          priceKzt: variant.priceKzt,
        })),
      })),
      fetchedAt: new Date().toISOString(),
    });
  }
}
