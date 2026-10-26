-- Additive expansion: the previous API's Product tables and enums remain unchanged.
CREATE TABLE "Dessert" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "tag" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dessert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Dessert_name_nonempty" CHECK (length("name") BETWEEN 1 AND 200),
  CONSTRAINT "Dessert_description_length" CHECK (length("description") <= 2000)
);

CREATE TABLE "DessertVariant" (
  "id" TEXT NOT NULL,
  "dessertId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "priceKzt" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "DessertVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DessertVariant_price_range" CHECK ("priceKzt" >= 0 AND "priceKzt" <= 100000000),
  CONSTRAINT "DessertVariant_label_nonempty" CHECK (length("label") BETWEEN 1 AND 40)
);

CREATE TABLE "Addon" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceKzt" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Addon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Addon_name_nonempty" CHECK (length("name") BETWEEN 1 AND 200),
  CONSTRAINT "Addon_price_range" CHECK ("priceKzt" >= 0 AND "priceKzt" <= 100000000)
);

CREATE INDEX "Dessert_available_sortOrder_idx" ON "Dessert"("available", "sortOrder");
CREATE INDEX "DessertVariant_dessertId_available_sortOrder_idx" ON "DessertVariant"("dessertId", "available", "sortOrder");
ALTER TABLE "DessertVariant" ADD CONSTRAINT "DessertVariant_dessertId_fkey"
  FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
