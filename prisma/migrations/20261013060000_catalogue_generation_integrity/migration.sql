BEGIN;

-- Abort rather than silently repairing catalogue data belonging to different generations.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "CatalogueEntry" e
    JOIN "BootVariant" v ON v.id = e."outsoleVariantId"
    JOIN "BootTier" t ON t.id = v."tierModelId"
    JOIN "BootColorway" c ON c.id = e."colorwayId"
    WHERE t."generationId" <> c."generationId"
  ) THEN
    RAISE EXCEPTION 'Catalogue generation mismatch: inspect existing entries before migrating';
  END IF;
END $$;

ALTER TABLE "BootVariant" ADD COLUMN "generationId" TEXT;
UPDATE "BootVariant" v SET "generationId" = t."generationId"
FROM "BootTier" t WHERE t.id = v."tierModelId";
ALTER TABLE "BootVariant" ALTER COLUMN "generationId" SET NOT NULL;

ALTER TABLE "CatalogueEntry" ADD COLUMN "generationId" TEXT;
UPDATE "CatalogueEntry" e SET "generationId" = v."generationId"
FROM "BootVariant" v WHERE v.id = e."outsoleVariantId";
ALTER TABLE "CatalogueEntry" ALTER COLUMN "generationId" SET NOT NULL;

CREATE UNIQUE INDEX "BootTier_id_generationId_key" ON "BootTier"(id, "generationId");
CREATE UNIQUE INDEX "BootVariant_id_generationId_key" ON "BootVariant"(id, "generationId");
CREATE UNIQUE INDEX "BootColorway_id_generationId_key" ON "BootColorway"(id, "generationId");

ALTER TABLE "BootVariant" DROP CONSTRAINT "BootVariant_tierModelId_fkey";
ALTER TABLE "BootVariant" ADD CONSTRAINT "BootVariant_tierModelId_generationId_fkey"
  FOREIGN KEY ("tierModelId", "generationId") REFERENCES "BootTier"(id, "generationId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CatalogueEntry" DROP CONSTRAINT "CatalogueEntry_outsoleVariantId_fkey";
ALTER TABLE "CatalogueEntry" DROP CONSTRAINT "CatalogueEntry_colorwayId_fkey";
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_outsoleVariantId_generationId_fkey"
  FOREIGN KEY ("outsoleVariantId", "generationId") REFERENCES "BootVariant"(id, "generationId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_colorwayId_generationId_fkey"
  FOREIGN KEY ("colorwayId", "generationId") REFERENCES "BootColorway"(id, "generationId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
