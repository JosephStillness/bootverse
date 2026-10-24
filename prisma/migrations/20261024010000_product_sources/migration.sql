-- Data D1: additive and atomic. Duplicate identities require operator reconciliation.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "BootBrand" GROUP BY lower(normalize(btrim(name),NFC)) HAVING count(*)>1) THEN
  RAISE EXCEPTION 'D1 preflight: duplicate normalized brand names; reconcile explicitly before migrating';
 END IF;
END $$;
-- CreateEnum
CREATE TYPE "ProductPublicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductVerificationState" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'CONFLICTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductSourceType" AS ENUM ('MANUFACTURER', 'RETAILER', 'PRODUCT_FEED', 'AFFILIATE_FEED', 'MANUAL_RESEARCH', 'COMMUNITY', 'OTHER');

-- AlterTable
ALTER TABLE "BootBrand" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "officialWebsite" VARCHAR(2000),
ADD COLUMN     "slug" VARCHAR(100),
ADD COLUMN     "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "BootVariant" ADD COLUMN     "constructionNote" VARCHAR(1000),
ADD COLUMN     "manufacturerOutsole" VARCHAR(120),
ALTER COLUMN "surface" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "BootColorway" ADD COLUMN     "colorNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "CatalogueEntry" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "slugLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "status" "ProductPublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RecommendationEvidence" ADD COLUMN     "countryCode" VARCHAR(2),
ADD COLUMN     "entryId" TEXT,
ADD COLUMN     "sourceId" TEXT;

-- CreateTable
CREATE TABLE "ProductSource" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "ProductSourceType" NOT NULL,
    "baseUrl" VARCHAR(2000) NOT NULL,
    "brandId" TEXT,
    "accessMethod" VARCHAR(120) NOT NULL,
    "authorizationStatus" VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    "permissionNotes" VARCHAR(1000),
    "permissionUrl" VARCHAR(2000),
    "usageRestrictions" VARCHAR(1000),
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "checkedById" TEXT,
    "authorizationCheckedAt" TIMESTAMPTZ(3),
    "lastCheckedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIdentifier" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "value" VARCHAR(120) NOT NULL,
    "region" VARCHAR(11) NOT NULL DEFAULT 'UNSPECIFIED',
    "sourceId" TEXT NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductClaim" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "variantId" TEXT,
    "attribute" VARCHAR(40) NOT NULL,
    "value" JSONB NOT NULL,
    "basis" VARCHAR(20) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ProductVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" VARCHAR(1000),
    "notes" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "uploadedImageId" TEXT,
    "externalUrl" VARCHAR(2000),
    "sourceId" TEXT NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "attribution" VARCHAR(300) NOT NULL,
    "altText" VARCHAR(300) NOT NULL,
    "licenseStatus" VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
    "permissionNotes" VARCHAR(1000),
    "permissionUrl" VARCHAR(2000),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "reviewedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSource_status_type_id_idx" ON "ProductSource"("status", "type", "id");

-- CreateIndex
CREATE INDEX "ProductSource_brandId_idx" ON "ProductSource"("brandId");

-- CreateIndex
CREATE INDEX "ProductSource_checkedById_idx" ON "ProductSource"("checkedById");

-- CreateIndex
CREATE INDEX "ProductIdentifier_entryId_idx" ON "ProductIdentifier"("entryId");

-- CreateIndex
CREATE INDEX "ProductIdentifier_sourceId_idx" ON "ProductIdentifier"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIdentifier_brandId_region_value_key" ON "ProductIdentifier"("brandId", "region", "value");

-- CreateIndex
CREATE INDEX "ProductClaim_entryId_status_attribute_idx" ON "ProductClaim"("entryId", "status", "attribute");

-- CreateIndex
CREATE INDEX "ProductClaim_variantId_status_attribute_idx" ON "ProductClaim"("variantId", "status", "attribute");

-- CreateIndex
CREATE INDEX "ProductClaim_sourceId_idx" ON "ProductClaim"("sourceId");

-- CreateIndex
CREATE INDEX "ProductClaim_reviewerId_idx" ON "ProductClaim"("reviewerId");

-- CreateIndex
CREATE INDEX "ProductImage_entryId_status_sortOrder_idx" ON "ProductImage"("entryId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_uploadedImageId_idx" ON "ProductImage"("uploadedImageId");

-- CreateIndex
CREATE INDEX "ProductImage_sourceId_idx" ON "ProductImage"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "BootBrand_slug_key" ON "BootBrand"("slug");

-- CreateIndex
CREATE INDEX "CatalogueEntry_status_createdAt_id_idx" ON "CatalogueEntry"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CatalogueEntry_sourceId_idx" ON "CatalogueEntry"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueEntry_id_outsoleVariantId_key" ON "CatalogueEntry"("id", "outsoleVariantId");

-- CreateIndex
CREATE INDEX "RecommendationEvidence_sourceId_idx" ON "RecommendationEvidence"("sourceId");

-- CreateIndex
CREATE INDEX "RecommendationEvidence_entryId_countryCode_observedAt_idx" ON "RecommendationEvidence"("entryId", "countryCode", "observedAt");

-- AddForeignKey
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvidence" ADD CONSTRAINT "RecommendationEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvidence" ADD CONSTRAINT "RecommendationEvidence_entryId_variantId_fkey" FOREIGN KEY ("entryId", "variantId") REFERENCES "CatalogueEntry"("id", "outsoleVariantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProductSource" ADD CONSTRAINT "ProductSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BootBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSource" ADD CONSTRAINT "ProductSource_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BootBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductClaim" ADD CONSTRAINT "ProductClaim_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductClaim" ADD CONSTRAINT "ProductClaim_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "BootVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductClaim" ADD CONSTRAINT "ProductClaim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductClaim" ADD CONSTRAINT "ProductClaim_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_uploadedImageId_fkey" FOREIGN KEY ("uploadedImageId") REFERENCES "UploadedImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No brand/source/SKU/specification is invented for legacy catalogue records.
CREATE UNIQUE INDEX "BootBrand_normalized_name_key" ON "BootBrand" (lower(normalize(btrim(name),NFC)));
ALTER TABLE "BootBrand" ADD CONSTRAINT "BootBrand_registry_check" CHECK (btrim(name)<>'' AND status IN ('ACTIVE','ARCHIVED') AND (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
ALTER TABLE "BootVariant" DROP CONSTRAINT "BootVariant_surface";
ALTER TABLE "BootVariant" ADD CONSTRAINT "BootVariant_surface" CHECK (surface IS NULL OR surface IN ('FG','AG','SG','TF','IN','MG','OTHER'));
UPDATE "CatalogueEntry" SET status=CASE WHEN published THEN 'PUBLISHED'::"ProductPublicationStatus" ELSE 'DRAFT'::"ProductPublicationStatus" END,"slugLocked"=published;
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_publication_check" CHECK (published=(status='PUBLISHED') AND version>0);

-- Legacy trusted boolean writers remain compatible; new admin operations use status.
CREATE FUNCTION bootverse_product_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (OLD."slugLocked" OR OLD.published) AND (NEW.slug IS DISTINCT FROM OLD.slug OR NEW."outsoleVariantId" IS DISTINCT FROM OLD."outsoleVariantId" OR NEW."colorwayId" IS DISTINCT FROM OLD."colorwayId" OR NEW."generationId" IS DISTINCT FROM OLD."generationId") THEN
   RAISE EXCEPTION 'Published product URL and identity are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status=OLD.status AND NEW.published IS DISTINCT FROM OLD.published THEN
   NEW.status=CASE WHEN NEW.published THEN 'PUBLISHED'::"ProductPublicationStatus" ELSE 'ARCHIVED'::"ProductPublicationStatus" END;
  ELSE NEW.published=(NEW.status='PUBLISHED'); END IF;
  NEW."slugLocked"=OLD."slugLocked" OR OLD.published OR NEW.published;
 ELSE
  IF NEW.published AND NEW.status='DRAFT' THEN NEW.status='PUBLISHED';
  ELSE NEW.published=(NEW.status='PUBLISHED'); END IF;
  NEW."slugLocked"=NEW.published;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER product_lifecycle BEFORE INSERT OR UPDATE ON "CatalogueEntry" FOR EACH ROW EXECUTE FUNCTION bootverse_product_lifecycle();

ALTER TABLE "ProductSource" ADD CONSTRAINT "ProductSource_permissions_check" CHECK (
 status IN ('ACTIVE','ARCHIVED') AND version>0 AND btrim(name)<>'' AND "baseUrl" ~ '^https://[^@[:space:]]+$'
 AND "authorizationStatus" IN ('UNKNOWN','REQUESTED','GRANTED','DENIED','NOT_REQUIRED')
 AND (type<>'MANUFACTURER' OR "brandId" IS NOT NULL)
 AND ("authorizationStatus" NOT IN ('GRANTED','NOT_REQUIRED') OR (coalesce(btrim("permissionNotes"),'')<>'' AND "permissionUrl" IS NOT NULL AND "permissionUrl" ~ '^https://[^@[:space:]]+$' AND "authorizationCheckedAt" IS NOT NULL))
);
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_scope_check" CHECK (
 value=btrim(normalize(value,NFC)) AND value<>'' AND region ~ '^(UNSPECIFIED|GLOBAL|[A-Z]{2})$' AND "sourceUrl" ~ '^https://[^@[:space:]]+$'
);
-- The redundant brand is required for scoped uniqueness and checked against ancestry.
CREATE FUNCTION bootverse_sku_brand() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected TEXT;
BEGIN
 SELECT f."brandId" INTO expected FROM "CatalogueEntry" e JOIN "BootGeneration" g ON g.id=e."generationId" JOIN "BootFamily" f ON f.id=g."familyId" WHERE e.id=NEW."entryId" FOR SHARE OF e,g,f;
 IF expected IS DISTINCT FROM NEW."brandId" THEN RAISE EXCEPTION 'SKU manufacturer does not match product' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sku_brand BEFORE INSERT OR UPDATE ON "ProductIdentifier" FOR EACH ROW EXECUTE FUNCTION bootverse_sku_brand();
CREATE FUNCTION bootverse_sku_parent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "ProductIdentifier" s JOIN "CatalogueEntry" e ON e.id=s."entryId" JOIN "BootGeneration" g ON g.id=e."generationId" JOIN "BootFamily" f ON f.id=g."familyId" WHERE s."brandId"<>f."brandId") THEN
  RAISE EXCEPTION 'Identity update would move a manufacturer SKU across brands' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sku_family_guard AFTER UPDATE OF "brandId" ON "BootFamily" FOR EACH ROW EXECUTE FUNCTION bootverse_sku_parent_guard();
CREATE TRIGGER sku_generation_guard AFTER UPDATE OF "familyId" ON "BootGeneration" FOR EACH ROW EXECUTE FUNCTION bootverse_sku_parent_guard();
CREATE TRIGGER sku_entry_guard AFTER UPDATE OF "generationId" ON "CatalogueEntry" FOR EACH ROW EXECUTE FUNCTION bootverse_sku_parent_guard();

-- Validate typed extensible claim values in PostgreSQL as well as at the API boundary.
CREATE FUNCTION bootverse_valid_claim(attribute TEXT, value JSONB, basis TEXT) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item JSONB; raw TEXT;
BEGIN
 IF basis NOT IN ('REPORTED','MEASURED','COMMUNITY','EXPERT') THEN RETURN false; END IF;
 IF attribute IN ('upperMaterial','upperTechnology','outsoleConstruction','studConfiguration','closureSystem','collarType','tongueConfiguration','surfaceDesignation','manufacturerFitDescription','construction') THEN
  RETURN jsonb_typeof(value)='string' AND char_length(btrim(value #>> '{}')) BETWEEN 1 AND 1000;
 ELSIF attribute='weight' THEN
  IF jsonb_typeof(value)<>'object' OR jsonb_typeof(value->'amount') IS DISTINCT FROM 'number' OR (value-ARRAY['amount','unit','size','sizeSystem','method'])<>'{}'::jsonb THEN RETURN false; END IF;
  RETURN coalesce((value->>'amount')::numeric>0 AND (value->>'amount')::numeric<=1000 AND value->>'unit' IN ('g','oz') AND jsonb_typeof(value->'size')='string' AND char_length(btrim(value->>'size')) BETWEEN 1 AND 30 AND value->>'sizeSystem' IN ('UK','US','EU','CM') AND (NOT(value?'method') OR (jsonb_typeof(value->'method')='string' AND char_length(btrim(value->>'method')) BETWEEN 1 AND 1000)) AND (basis<>'MEASURED' OR coalesce(btrim(value->>'method'),'')<>''),false);
 ELSIF attribute='releaseDate' THEN
  raw=value #>> '{}';
  RETURN coalesce(jsonb_typeof(value)='string' AND raw ~ '^\d{4}-\d{2}-\d{2}$' AND to_char(raw::date,'YYYY-MM-DD')=raw,false);
 ELSIF attribute='additionalFeatures' THEN
  IF jsonb_typeof(value)<>'array' OR jsonb_array_length(value) NOT BETWEEN 1 AND 20 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP
   IF jsonb_typeof(item)<>'string' OR char_length(btrim(item #>> '{}')) NOT BETWEEN 1 AND 200 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
 END IF;
 RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE "ProductClaim" ADD CONSTRAINT "ProductClaim_value_check" CHECK (num_nonnulls("entryId","variantId")=1 AND version>0 AND bootverse_valid_claim(attribute,value,basis) AND "sourceUrl" ~ '^https://[^@[:space:]]+$' AND (status<>'VERIFIED' OR ("reviewedAt" IS NOT NULL AND coalesce(btrim("reviewNote"),'')<>'')));
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_permission_check" CHECK (
 num_nonnulls("uploadedImageId","externalUrl")=1 AND ("externalUrl" IS NULL OR "externalUrl" ~ '^https://[^@[:space:]]+$') AND "sourceUrl" ~ '^https://[^@[:space:]]+$'
 AND btrim("altText")<>'' AND btrim(attribution)<>'' AND "sortOrder" BETWEEN 0 AND 1000 AND version>0 AND "licenseStatus" IN ('UNKNOWN','GRANTED','DENIED')
 AND ("licenseStatus"<>'GRANTED' OR (coalesce(btrim("permissionNotes"),'')<>'' AND "permissionUrl" IS NOT NULL AND "permissionUrl" ~ '^https://[^@[:space:]]+$'))
 AND (status<>'VERIFIED' OR ("licenseStatus"='GRANTED' AND "reviewedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "ProductImage_primary_key" ON "ProductImage"("entryId") WHERE "isPrimary";
ALTER TABLE "RecommendationEvidence" ADD CONSTRAINT "RecommendationEvidence_offer_scope" CHECK (("countryCode" IS NULL OR ("countryCode" ~ '^[A-Z]{2}$' AND kind IN ('PRICE','AVAILABILITY'))) AND ("entryId" IS NULL OR (kind IN ('PRICE','AVAILABILITY') AND payload->>'entryId'="entryId")));
-- Only valid legacy references are linked. No source/retailer/region is guessed.
UPDATE "RecommendationEvidence" r SET "entryId"=e.id FROM "CatalogueEntry" e WHERE r.kind IN ('PRICE','AVAILABILITY') AND r.payload->>'entryId'=e.id AND r."variantId"=e."outsoleVariantId";
COMMIT;

