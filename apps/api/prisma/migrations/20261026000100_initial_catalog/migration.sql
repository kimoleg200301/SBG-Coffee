CREATE TYPE "Category" AS ENUM ('coffee', 'tea', 'seasonal');
CREATE TYPE "ProductImage" AS ENUM ('americano', 'cappuccino', 'latte', 'chocolate', 'pumpkin', 'lavender');

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "Category" NOT NULL,
  "image" "ProductImage" NOT NULL,
  "tag" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_name_nonempty" CHECK (length("name") BETWEEN 1 AND 200),
  CONSTRAINT "Product_description_length" CHECK (length("description") <= 2000)
);

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "volumeMl" INTEGER NOT NULL,
  "priceKzt" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_volume_range" CHECK ("volumeMl" > 0 AND "volumeMl" <= 10000),
  CONSTRAINT "ProductVariant_price_range" CHECK ("priceKzt" >= 0 AND "priceKzt" <= 100000000),
  CONSTRAINT "ProductVariant_label_nonempty" CHECK (length("label") BETWEEN 1 AND 40)
);

CREATE INDEX "Product_available_sortOrder_idx" ON "Product"("available", "sortOrder");
CREATE INDEX "ProductVariant_productId_available_sortOrder_idx" ON "ProductVariant"("productId", "available", "sortOrder");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
