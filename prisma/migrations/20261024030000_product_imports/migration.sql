-- D2 additive tracking; existing values preserved. No remote migration.
BEGIN;
-- AlterTable
ALTER TABLE "BootColorway" ALTER COLUMN "swatch" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RecommendationEvidence" ADD COLUMN     "importRowId" TEXT;

-- AlterTable
ALTER TABLE "ProductClaim" ADD COLUMN     "importRowId" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "importRowId" TEXT;

-- CreateTable
CREATE TABLE "ProductImportBatch" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "actorId" TEXT,
    "format" VARCHAR(10) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'RUNNING',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "sourceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "errorCode" VARCHAR(64),
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ProductImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSourceRecord" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "recordId" VARCHAR(120) NOT NULL,
    "entryId" TEXT,
    "checksum" VARCHAR(64) NOT NULL,
    "identityHash" VARCHAR(64) NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "recordId" VARCHAR(120),
    "entryId" TEXT,
    "outcome" VARCHAR(24) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "checksum" VARCHAR(64),
    "sourceUrl" VARCHAR(2000),
    "observedAt" TIMESTAMPTZ(3),
    "verificationStatus" "ProductVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "data" JSONB,
    "diagnostics" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImportBatch_startedAt_id_idx" ON "ProductImportBatch"("startedAt", "id");

-- CreateIndex
CREATE INDEX "ProductImportBatch_actorId_idx" ON "ProductImportBatch"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImportBatch_sourceId_idempotencyKey_key" ON "ProductImportBatch"("sourceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImportBatch_sourceId_id_key" ON "ProductImportBatch"("sourceId", "id");

-- CreateIndex
CREATE INDEX "ProductSourceRecord_entryId_idx" ON "ProductSourceRecord"("entryId");

-- CreateIndex
CREATE INDEX "ProductSourceRecord_lastBatchId_idx" ON "ProductSourceRecord"("lastBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSourceRecord_sourceId_recordId_key" ON "ProductSourceRecord"("sourceId", "recordId");

-- CreateIndex
CREATE INDEX "ProductImportRow_entryId_idx" ON "ProductImportRow"("entryId");

-- CreateIndex
CREATE INDEX "ProductImportRow_batchId_outcome_rowNumber_idx" ON "ProductImportRow"("batchId", "outcome", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImportRow_batchId_rowNumber_key" ON "ProductImportRow"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "RecommendationEvidence_importRowId_idx" ON "RecommendationEvidence"("importRowId");

-- CreateIndex
CREATE INDEX "ProductClaim_importRowId_idx" ON "ProductClaim"("importRowId");

-- CreateIndex
CREATE INDEX "ProductImage_importRowId_idx" ON "ProductImage"("importRowId");

-- AddForeignKey
ALTER TABLE "RecommendationEvidence" ADD CONSTRAINT "RecommendationEvidence_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ProductImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductClaim" ADD CONSTRAINT "ProductClaim_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ProductImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ProductImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportBatch" ADD CONSTRAINT "ProductImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportBatch" ADD CONSTRAINT "ProductImportBatch_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSourceRecord" ADD CONSTRAINT "ProductSourceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSourceRecord" ADD CONSTRAINT "ProductSourceRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSourceRecord" ADD CONSTRAINT "ProductSourceRecord_sourceId_lastBatchId_fkey" FOREIGN KEY ("sourceId", "lastBatchId") REFERENCES "ProductImportBatch"("sourceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportRow" ADD CONSTRAINT "ProductImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportRow" ADD CONSTRAINT "ProductImportRow_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductImportBatch" ADD CONSTRAINT "ProductImportBatch_valid" CHECK (
 format IN ('CSV','JSON') AND checksum ~ '^[0-9a-f]{64}$' AND "idempotencyKey" ~ '^[A-Za-z0-9_-]{16,100}$'
 AND status IN ('RUNNING','SUCCEEDED','FAILED') AND jsonb_typeof(summary)='object' AND jsonb_typeof("sourceSnapshot")='object' AND octet_length("sourceSnapshot"::text)<=8192
 AND ((status='RUNNING' AND "completedAt" IS NULL) OR (status<>'RUNNING' AND "completedAt" IS NOT NULL))
);
ALTER TABLE "ProductSourceRecord" ADD CONSTRAINT "ProductSourceRecord_valid" CHECK (
 btrim("recordId")<>'' AND checksum ~ '^[0-9a-f]{64}$' AND "identityHash" ~ '^[0-9a-f]{64}$' AND "sourceUrl" ~ '^https://[^@[:space:]]+$'
);
ALTER TABLE "ProductImportRow" ADD CONSTRAINT "ProductImportRow_valid" CHECK (
 "rowNumber">0 AND outcome IN ('NEW_RECORD','EXACT_MATCH','POSSIBLE_MATCH','CONFLICT','INSUFFICIENT_IDENTITY','INVALID')
 AND action IN ('CREATE_DRAFT','NOOP','STAGE','QUARANTINE','REJECT')
 AND (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$')
 AND (data IS NULL OR (jsonb_typeof(data)='object' AND octet_length(data::text)<=65536))
 AND ("sourceUrl" IS NULL OR "sourceUrl" ~ '^https://[^@[:space:]]+$')
 AND jsonb_typeof(diagnostics)='array' AND jsonb_array_length(diagnostics)<=30
);
COMMIT;
