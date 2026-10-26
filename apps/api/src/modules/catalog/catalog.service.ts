import { Inject, Injectable } from '@nestjs/common';
import { catalogResponseSchema, catalogV2ResponseSchema, type CatalogResponseDto, type CatalogV2ResponseDto } from '@sbg/contracts';
import { Prisma } from '@prisma/client';
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
  async listV2(): Promise<CatalogV2ResponseDto> {
    // A single snapshot prevents an import from mixing old drink and new addon prices.
    const [products, desserts, additions] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { available: true, variants: { some: { available: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { variants: { where: { available: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
      }),
      this.prisma.dessert.findMany({
        where: { available: true, variants: { some: { available: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { variants: { where: { available: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
      }),
      this.prisma.addon.findMany({ where: { available: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const addons = additions.map(({ id, name, priceKzt }) => ({ id, name, priceKzt }));
    return catalogV2ResponseSchema.parse({
      products: [
        ...products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          image: product.category === 'tea' ? 'tea' : product.image,
          ...(product.tag === null ? {} : { tag: product.tag }),
          variants: product.variants.map(({ id, label, volumeMl, priceKzt }) => ({ id, label, volumeMl, priceKzt })),
          addons,
        })),
        ...desserts.map((dessert) => ({
          id: dessert.id,
          name: dessert.name,
          description: dessert.description,
          category: 'dessert',
          image: 'dessert',
          ...(dessert.tag === null ? {} : { tag: dessert.tag }),
          variants: dessert.variants.map(({ id, label, priceKzt }) => ({ id, label, volumeMl: null, priceKzt })),
          addons: [],
        })),
      ],
      fetchedAt: new Date().toISOString(),
    });
  }

}
