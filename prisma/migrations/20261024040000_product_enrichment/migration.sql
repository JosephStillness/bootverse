BEGIN;
-- AlterTable
ALTER TABLE "UploadedImage" ADD COLUMN     "productEntryId" TEXT,
ADD COLUMN     "sha256" VARCHAR(64);

-- AlterTable
ALTER TABLE "ProductClaim" ADD COLUMN     "observationKey" VARCHAR(64),
ADD COLUMN     "originalObservation" JSONB,
ADD COLUMN     "sourceRevision" VARCHAR(200);

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "assetKey" VARCHAR(64);

-- AlterTable
ALTER TABLE "ProductImportBatch" ADD COLUMN     "purpose" VARCHAR(12) NOT NULL DEFAULT 'IMPORT';

-- CreateIndex
CREATE INDEX "UploadedImage_productEntryId_idx" ON "UploadedImage"("productEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedImage_productEntryId_sha256_key" ON "UploadedImage"("productEntryId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ProductClaim_observationKey_key" ON "ProductClaim"("observationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_entryId_assetKey_key" ON "ProductImage"("entryId", "assetKey");

-- CreateIndex
CREATE INDEX "ProductImportBatch_purpose_startedAt_id_idx" ON "ProductImportBatch"("purpose", "startedAt", "id");

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_productEntryId_fkey" FOREIGN KEY ("productEntryId") REFERENCES "CatalogueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "UploadedImage" DROP CONSTRAINT image_target;
ALTER TABLE "UploadedImage" ADD CONSTRAINT image_target CHECK (
 (slot='AVATAR' AND "profileId" IS NOT NULL OR slot='COVER' AND "creatorId" IS NOT NULL OR slot='POST' AND "postId" IS NOT NULL OR slot='REVIEW' AND "reviewId" IS NOT NULL OR slot='PRODUCT' AND "productEntryId" IS NOT NULL)
 AND num_nonnulls("profileId","creatorId","postId","reviewId","productEntryId")=1
);
ALTER TABLE "UploadedImage" ADD CONSTRAINT product_hash_check CHECK ("sha256" IS NULL OR "sha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "ProductClaim" ADD CONSTRAINT observation_metadata_check CHECK (
 ("observationKey" IS NULL OR "observationKey" ~ '^[a-f0-9]{64}$') AND
 ("sourceRevision" IS NULL OR char_length(btrim("sourceRevision")) BETWEEN 1 AND 200) AND
 ("originalObservation" IS NULL OR (jsonb_typeof("originalObservation")='object' AND octet_length("originalObservation"::text)<=16384))
);
ALTER TABLE "ProductImage" ADD CONSTRAINT asset_key_check CHECK ("assetKey" IS NULL OR "assetKey" ~ '^[a-f0-9]{64}$');
ALTER TABLE "ProductImportBatch" ADD CONSTRAINT import_purpose_check CHECK (purpose IN ('IMPORT','ENRICHMENT'));
CREATE OR REPLACE FUNCTION bootverse_valid_claim(attribute TEXT, value JSONB, basis TEXT) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item JSONB; raw TEXT;
BEGIN
 IF value='{"unknown":true}'::jsonb THEN RETURN attribute IN ('upperMaterial','upperTechnology','outsoleConstruction','studConfiguration','closureSystem','collarType','tongueConfiguration','surfaceDesignation','manufacturerFitDescription','construction','surfaceTexture','toeBoxConstruction','midfootConstruction','heelStructure','soleplateMaterial','soleplateTechnology','playingSurfaceGuidance','weight','releaseDate','additionalFeatures','normalizedOutsoleCategory') AND basis IN ('REPORTED','MEASURED','COMMUNITY','EXPERT'); END IF;
 IF basis NOT IN ('REPORTED','MEASURED','COMMUNITY','EXPERT') THEN RETURN false; END IF;
 IF attribute IN ('upperMaterial','upperTechnology','outsoleConstruction','studConfiguration','closureSystem','collarType','tongueConfiguration','surfaceDesignation','manufacturerFitDescription','construction','surfaceTexture','toeBoxConstruction','midfootConstruction','heelStructure','soleplateMaterial','soleplateTechnology','playingSurfaceGuidance') THEN
  RETURN jsonb_typeof(value)='string' AND char_length(btrim(value #>> '{}')) BETWEEN 1 AND 1000;
 ELSIF attribute='normalizedOutsoleCategory' THEN
  RETURN coalesce(jsonb_typeof(value)='string' AND value #>> '{}' IN ('FG','AG','SG','TF','IN','MG','OTHER'),false);
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

ALTER TABLE "ModerationAction" ADD COLUMN details JSONB;
ALTER TABLE "ModerationAction" ADD CONSTRAINT audit_details_check CHECK (details IS NULL OR (jsonb_typeof(details)='object' AND octet_length(details::text)<=65536));
COMMIT;
