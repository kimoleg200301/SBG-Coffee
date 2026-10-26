import { readFile } from 'node:fs/promises';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { catalogV2ResponseSchema } from '@sbg/contracts';
import { menuManifestSchema, realMenuManifest } from './real-menu';

type MenuEntity = 'Product' | 'ProductVariant' | 'Dessert' | 'DessertVariant' | 'Addon';
type RowData = Record<string, string | number | boolean | null>;
export type MenuChange = {
  entity: MenuEntity;
  id: string;
  action: 'create' | 'update' | 'unchanged';
  before?: RowData;
  after: RowData;
};
export type MenuImportPlan = { applied: boolean; changes: MenuChange[]; counts: Record<MenuChange['action'], number> };
export class MenuImportError extends Error {}

function ensureSeparateIds(drinks: Iterable<string>, desserts: Iterable<string>, kind: string) {
  const drinkIds = new Set(drinks);
  for (const id of desserts) {
    if (drinkIds.has(id)) throw new MenuImportError(`${kind} ID collision between drinks and desserts: ${id}`);
  }
}
function ensureOwner(existing: { id: string; productId?: string; dessertId?: string } | undefined, owner: string) {
  if (existing && (existing.productId ?? existing.dessertId) !== owner) {
    throw new MenuImportError(`Variant ${existing.id} belongs to another product; reparenting is forbidden`);
  }
}

/** Validate first, then inspect and optionally change only manifest-owned IDs atomically. */
export async function importMenu(prisma: PrismaClient, input: unknown = realMenuManifest, apply = false): Promise<MenuImportPlan> {
  // Parsing is deliberately outside the transaction: malformed input cannot write anything.
  const menu = menuManifestSchema.parse(input);
  return prisma.$transaction(async (transaction) => {
    // Serializes this importer, including dry-run, without locking out catalog readers.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(73624720)`;
    // All rows, including hidden/unmanaged ones, matter for the shared v2 ID namespace.
    const [products, variants, desserts, dessertVariants, addons] = await Promise.all([
      transaction.product.findMany(), transaction.productVariant.findMany(),
      transaction.dessert.findMany(), transaction.dessertVariant.findMany(), transaction.addon.findMany(),
    ]);
    const productById = new Map(products.map((row) => [row.id, row]));
    const variantById = new Map(variants.map((row) => [row.id, row]));
    const dessertById = new Map(desserts.map((row) => [row.id, row]));
    const dessertVariantById = new Map(dessertVariants.map((row) => [row.id, row]));
    const addonById = new Map(addons.map((row) => [row.id, row]));
    ensureSeparateIds(
      [...productById.keys(), ...menu.products.map((row) => row.id)],
      [...dessertById.keys(), ...menu.desserts.map((row) => row.id)], 'Product',
    );
    ensureSeparateIds(
      [...variantById.keys(), ...menu.products.flatMap((row) => row.variants.map((variant) => variant.id))],
      [...dessertVariantById.keys(), ...menu.desserts.flatMap((row) => row.variants.map((variant) => variant.id))], 'Variant',
    );
    for (const product of menu.products) for (const variant of product.variants) ensureOwner(variantById.get(variant.id), product.id);
    for (const dessert of menu.desserts) for (const variant of dessert.variants) ensureOwner(dessertVariantById.get(variant.id), dessert.id);

    const changes: MenuChange[] = [];
    const writes: (() => Promise<unknown>)[] = [];
    function plan(entity: MenuEntity, after: RowData & { id: string }, current: object | undefined, write: () => Promise<unknown>) {
      // Compare only fields managed by the manifest; timestamps are neither compared nor overwritten.
      const before = current === undefined ? undefined : Object.fromEntries(Object.keys(after).map((key) => [key, (current as RowData)[key]!])) as RowData;
      const action = before === undefined ? 'create' : Object.keys(after).some((key) => before[key] !== after[key]) ? 'update' : 'unchanged';
      changes.push({ entity, id: after.id, action, ...(before ? { before } : {}), after });
      if (action !== 'unchanged') writes.push(write);
    }
    for (const [sortOrder, product] of menu.products.entries()) {
      const { variants: productVariants, ...fields } = product;
      const data = { ...fields, tag: product.tag ?? null, sortOrder };
      plan('Product', data, productById.get(product.id), () => transaction.product.upsert({ where: { id: data.id }, create: data, update: data }));
      for (const [variantSortOrder, variant] of productVariants.entries()) {
        const data = { ...variant, productId: product.id, sortOrder: variantSortOrder };
        plan('ProductVariant', data, variantById.get(variant.id), () => transaction.productVariant.upsert({ where: { id: data.id }, create: data, update: data }));
      }
    }
    for (const [sortOrder, dessert] of menu.desserts.entries()) {
      const { variants: itemVariants, ...fields } = dessert;
      const data = { ...fields, tag: dessert.tag ?? null, sortOrder };
      plan('Dessert', data, dessertById.get(dessert.id), () => transaction.dessert.upsert({ where: { id: data.id }, create: data, update: data }));
      for (const [variantSortOrder, variant] of itemVariants.entries()) {
        const data = { ...variant, dessertId: dessert.id, sortOrder: variantSortOrder };
        plan('DessertVariant', data, dessertVariantById.get(variant.id), () => transaction.dessertVariant.upsert({ where: { id: data.id }, create: data, update: data }));
      }
    }
    for (const [sortOrder, addon] of menu.addons.entries()) {
      const data = { ...addon, sortOrder };
      plan('Addon', data, addonById.get(addon.id), () => transaction.addon.upsert({ where: { id: data.id }, create: data, update: data }));
    }
    // Preserved unmanaged rows can push limits or conflict with the public catalog.
    // Validate the complete projected response, not just each manifest record in isolation.
    function projected(entity: MenuEntity, rows: { id: string }[]) {
      const merged = new Map<string, Record<string, unknown>>(rows.map((row) => [row.id, { ...row }]));
      for (const change of changes) if (change.entity === entity) merged.set(change.id, change.after);
      return [...merged.values()];
    }
    const projectedAddons = projected('Addon', addons).filter((row) => row.available)
      .map(({ id, name, priceKzt }) => ({ id, name, priceKzt }));
    function publicProducts(rows: Record<string, unknown>[], variants: Record<string, unknown>[], dessert: boolean) {
      const byOwner = new Map<unknown, Record<string, unknown>[]>();
      for (const variant of variants) {
        if (!variant.available) continue;
        const owner = dessert ? variant.dessertId : variant.productId;
        const group = byOwner.get(owner) ?? [];
        group.push({ id: variant.id, label: variant.label, volumeMl: dessert ? null : variant.volumeMl, priceKzt: variant.priceKzt });
        byOwner.set(owner, group);
      }
      return rows.filter((row) => row.available && byOwner.has(row.id)).map((row) => ({
        id: row.id, name: row.name, description: row.description,
        category: dessert ? 'dessert' : row.category,
        image: dessert ? 'dessert' : row.category === 'tea' ? 'tea' : row.image,
        ...(row.tag === null ? {} : { tag: row.tag }),
        variants: byOwner.get(row.id), addons: dessert ? [] : projectedAddons,
      }));
    }
    catalogV2ResponseSchema.parse({
      fetchedAt: new Date().toISOString(),
      products: [
        ...publicProducts(projected('Product', products), projected('ProductVariant', variants), false),
        ...publicProducts(projected('Dessert', desserts), projected('DessertVariant', dessertVariants), true),
      ],
    });
    // No write happens before the entire plan and every ownership check are complete.
    if (apply) for (const write of writes) await write();
    return {
      applied: apply,
      changes,
      counts: {
        create: changes.filter((change) => change.action === 'create').length,
        update: changes.filter((change) => change.action === 'update').length,
        unchanged: changes.filter((change) => change.action === 'unchanged').length,
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
}

export function formatImportPlan(plan: MenuImportPlan): string {
  const lines = [`${plan.applied ? 'APPLIED' : 'DRY RUN (no data changed)'}: create=${plan.counts.create}, update=${plan.counts.update}, unchanged=${plan.counts.unchanged}`];
  for (const change of plan.changes) {
    if (change.action === 'unchanged') continue;
    const fields = Object.entries(change.after).filter(([key, value]) => !change.before || change.before[key] !== value)
      .map(([key, value]) => `${key}: ${change.before ? `${JSON.stringify(change.before[key])} -> ` : ''}${JSON.stringify(value)}`).join(', ');
    lines.push(`${change.action} ${change.entity} ${change.id}: ${fields}`);
  }
  return lines.join('\n');
}
async function main() {
  const args = process.argv.slice(2);
  let apply = false;
  let manifestPath: string | undefined;
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--apply' && !apply) apply = true;
    else if (arg === '--manifest' && !manifestPath && args[0] && !args[0].startsWith('--')) manifestPath = args.shift();
    else throw new MenuImportError('Usage: import-menu [--apply] [--manifest /path/to/menu.json]');
  }
  // File and schema validation happen before Prisma is initialized.
  const menu = menuManifestSchema.parse(manifestPath ? JSON.parse(await readFile(manifestPath, 'utf8')) : realMenuManifest);
  const prisma = new PrismaClient();
  try {
    console.log(formatImportPlan(await importMenu(prisma, menu, apply)));
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) {
  void main().catch((error: unknown) => {
    if (error instanceof MenuImportError) console.error(error.message);
    else if (error instanceof z.ZodError) console.error(`Invalid menu manifest: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
    else console.error('Menu import failed. Check the manifest, database connection and migrations. No partial changes were applied.');
    process.exitCode = 1;
  });
}
