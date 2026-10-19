-- Preserve visibility of pre-existing catalogue entries; new entries require explicit publication.
ALTER TABLE "CatalogueEntry" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "specifications" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "CatalogueEntry" ALTER COLUMN "published" SET DEFAULT false;
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_specifications_object" CHECK (jsonb_typeof("specifications") = 'object');
CREATE INDEX "CatalogueEntry_published_id_idx" ON "CatalogueEntry"("published", "id");
