BEGIN;
-- D5 source synchronization: additive only. No product is published, merged or removed; sync stays disabled per source.
-- CreateEnum
CREATE TYPE "OfferAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'DISCONTINUED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "ProductSource" ADD COLUMN     "adapterKey" VARCHAR(80),
ADD COLUMN     "backoffUntil" TIMESTAMPTZ(3),
ADD COLUMN     "fieldPolicy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "lastSyncAttemptAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastSyncErrorCategory" VARCHAR(30),
ADD COLUMN     "lastSyncSuccessAt" TIMESTAMPTZ(3),
ADD COLUMN     "minIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "nextSyncAt" TIMESTAMPTZ(3),
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncIntervalMinutes" INTEGER;

-- CreateTable
CREATE TABLE "SourceSyncJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "trigger" VARCHAR(16) NOT NULL,
    "entryPoint" VARCHAR(20) NOT NULL,
    "mode" VARCHAR(8) NOT NULL DEFAULT 'RUN',
    "actorId" TEXT,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'RUNNING',
    "leaseOwner" VARCHAR(100) NOT NULL,
    "leaseExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "heartbeatAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "durationMs" INTEGER,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "errorCategory" VARCHAR(30),
    "errorDetail" VARCHAR(300),
    "batchId" TEXT,

    CONSTRAINT "SourceSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSyncChange" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lastSeenJobId" VARCHAR(40) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entryId" TEXT,
    "recordId" VARCHAR(120) NOT NULL,
    "outcome" VARCHAR(30) NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "severity" VARCHAR(10) NOT NULL,
    "attribute" VARCHAR(40),
    "previousValue" JSONB,
    "proposedValue" JSONB,
    "claimId" VARCHAR(40),
    "disposition" VARCHAR(16) NOT NULL,
    "changeKey" VARCHAR(64) NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSyncChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOffer" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "listingKey" VARCHAR(160) NOT NULL,
    "recordId" VARCHAR(120) NOT NULL,
    "entryId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "size" VARCHAR(6),
    "sizeSystem" VARCHAR(4),
    "currency" VARCHAR(3),
    "amount" DECIMAL(10,2),
    "previousAmount" DECIMAL(10,2),
    "previousCurrency" VARCHAR(3),
    "availability" "OfferAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "rawAvailability" VARCHAR(60),
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastChangedAt" TIMESTAMPTZ(3) NOT NULL,
    "missingSince" TIMESTAMPTZ(3),
    "priceMissingSince" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOfferObservation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "jobId" TEXT,
    "change" VARCHAR(24) NOT NULL,
    "amount" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "availability" "OfferAvailability" NOT NULL,
    "rawAvailability" VARCHAR(60),
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductOfferObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAlert" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "jobId" TEXT,
    "kind" VARCHAR(30) NOT NULL,
    "severity" VARCHAR(8) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "status" VARCHAR(14) NOT NULL DEFAULT 'OPEN',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "delivery" VARCHAR(16) NOT NULL,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerNonce" (
    "nonce" VARCHAR(64) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulerNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE INDEX "SourceSyncJob_sourceId_startedAt_id_idx" ON "SourceSyncJob"("sourceId", "startedAt", "id");

-- CreateIndex
CREATE INDEX "SourceSyncJob_status_leaseExpiresAt_idx" ON "SourceSyncJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "SourceSyncJob_actorId_idx" ON "SourceSyncJob"("actorId");

-- CreateIndex
CREATE INDEX "SourceSyncJob_batchId_idx" ON "SourceSyncJob"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSyncJob_sourceId_idempotencyKey_key" ON "SourceSyncJob"("sourceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSyncChange_changeKey_key" ON "SourceSyncChange"("changeKey");

-- CreateIndex
CREATE INDEX "SourceSyncChange_entryId_disposition_idx" ON "SourceSyncChange"("entryId", "disposition");

-- CreateIndex
CREATE INDEX "SourceSyncChange_jobId_idx" ON "SourceSyncChange"("jobId");

-- CreateIndex
CREATE INDEX "SourceSyncChange_sourceId_createdAt_idx" ON "SourceSyncChange"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceSyncChange_resolvedById_idx" ON "SourceSyncChange"("resolvedById");

-- CreateIndex
CREATE INDEX "ProductOffer_entryId_variantId_idx" ON "ProductOffer"("entryId", "variantId");

-- CreateIndex
CREATE INDEX "ProductOffer_variantId_idx" ON "ProductOffer"("variantId");

-- CreateIndex
CREATE INDEX "ProductOffer_sourceId_lastObservedAt_idx" ON "ProductOffer"("sourceId", "lastObservedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOffer_sourceId_listingKey_key" ON "ProductOffer"("sourceId", "listingKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOfferObservation_evidenceId_key" ON "ProductOfferObservation"("evidenceId");

-- CreateIndex
CREATE INDEX "ProductOfferObservation_jobId_idx" ON "ProductOfferObservation"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOfferObservation_offerId_observedAt_key" ON "ProductOfferObservation"("offerId", "observedAt");

-- CreateIndex
CREATE INDEX "SourceAlert_status_lastSeenAt_idx" ON "SourceAlert"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SourceAlert_sourceId_idx" ON "SourceAlert"("sourceId");

-- CreateIndex
CREATE INDEX "SourceAlert_jobId_idx" ON "SourceAlert"("jobId");

-- CreateIndex
CREATE INDEX "SourceAlert_acknowledgedById_idx" ON "SourceAlert"("acknowledgedById");

-- CreateIndex
CREATE INDEX "SchedulerNonce_receivedAt_idx" ON "SchedulerNonce"("receivedAt");

-- CreateIndex
CREATE INDEX "ProductSource_syncEnabled_nextSyncAt_idx" ON "ProductSource"("syncEnabled", "nextSyncAt");

-- AddForeignKey
ALTER TABLE "SourceSyncJob" ADD CONSTRAINT "SourceSyncJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncJob" ADD CONSTRAINT "SourceSyncJob_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncJob" ADD CONSTRAINT "SourceSyncJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncChange" ADD CONSTRAINT "SourceSyncChange_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceSyncJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncChange" ADD CONSTRAINT "SourceSyncChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncChange" ADD CONSTRAINT "SourceSyncChange_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncChange" ADD CONSTRAINT "SourceSyncChange_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_entryId_variantId_fkey" FOREIGN KEY ("entryId", "variantId") REFERENCES "CatalogueEntry"("id", "outsoleVariantId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "BootVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOfferObservation" ADD CONSTRAINT "ProductOfferObservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ProductOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOfferObservation" ADD CONSTRAINT "ProductOfferObservation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceSyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOfferObservation" ADD CONSTRAINT "ProductOfferObservation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "RecommendationEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAlert" ADD CONSTRAINT "SourceAlert_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProductSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAlert" ADD CONSTRAINT "SourceAlert_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceSyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAlert" ADD CONSTRAINT "SourceAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Scheduling configuration integrity. Credentials never live in this table.
ALTER TABLE "ProductSource" ADD CONSTRAINT product_source_sync_check CHECK (
  "minIntervalMinutes" BETWEEN 5 AND 43200
  AND ("syncIntervalMinutes" IS NULL OR "syncIntervalMinutes" BETWEEN 5 AND 43200)
  AND ("syncIntervalMinutes" IS NULL OR "syncIntervalMinutes">="minIntervalMinutes")
  AND ("adapterKey" IS NULL OR "adapterKey" ~ '^(fixture|http):[a-z0-9-]{1,60}$')
  AND (NOT "syncEnabled" OR ("adapterKey" IS NOT NULL AND "syncIntervalMinutes" IS NOT NULL))
  AND "syncFailureCount" BETWEEN 0 AND 100000
  AND jsonb_typeof("fieldPolicy")='object' AND octet_length("fieldPolicy"::text)<=4096
  AND ("lastSyncErrorCategory" IS NULL OR "lastSyncErrorCategory" ~ '^[A-Z_]{2,30}$')
);

ALTER TABLE "ProductImportBatch" DROP CONSTRAINT import_purpose_check;
ALTER TABLE "ProductImportBatch" ADD CONSTRAINT import_purpose_check CHECK (purpose IN ('IMPORT','ENRICHMENT','SYNC'));

ALTER TABLE "ProductReviewDecision" DROP CONSTRAINT product_review_decision_check;
ALTER TABLE "ProductReviewDecision" ADD CONSTRAINT product_review_decision_check CHECK (
  kind IN ('SUBMIT','APPROVE','REJECT','RETURN','REOPEN','ARCHIVE','RESUBMIT','NOTE','CONFLICT_RESOLUTION','DUPLICATE_RESOLUTION','SYNC_CHANGE')
  AND char_length(btrim(reason)) BETWEEN 10 AND 2000
  AND btrim("entryKey")<>''
  AND "entryVersion">0
  AND jsonb_typeof(details)='object' AND octet_length(details::text)<=65536
  AND ("reviewFingerprint" IS NULL OR "reviewFingerprint" ~ '^[a-f0-9]{64}$')
  AND ("requestHash" IS NULL OR "requestHash" ~ '^[a-f0-9]{64}$')
  AND (("requestKey" IS NULL)=("requestHash" IS NULL))
  AND (("fromStatus" IS NULL)=("toStatus" IS NULL))
  AND (kind NOT IN ('SUBMIT','APPROVE','REJECT','RETURN','REOPEN','ARCHIVE','RESUBMIT') OR "toStatus" IS NOT NULL)
  AND (kind<>'APPROVE' OR ("toStatus"='PUBLISHED' AND "reviewFingerprint" IS NOT NULL))
);

ALTER TABLE "SourceSyncJob" ADD CONSTRAINT source_sync_job_check CHECK (
  trigger IN ('SCHEDULED','MANUAL') AND "entryPoint" IN ('scheduler','cli','admin','internal_endpoint')
  AND mode IN ('RUN','PREVIEW') AND status IN ('RUNNING','SUCCEEDED','FAILED','CANCELLED','ABANDONED')
  AND "idempotencyKey" ~ '^[A-Za-z0-9:_-]{8,120}$'
  AND ((status='RUNNING' AND "completedAt" IS NULL) OR (status<>'RUNNING' AND "completedAt" IS NOT NULL))
  AND ("durationMs" IS NULL OR "durationMs">=0)
  AND jsonb_typeof(summary)='object' AND octet_length(summary::text)<=16384
  AND ("errorCategory" IS NULL OR "errorCategory" ~ '^[A-Z_]{2,30}$')
);
-- Per-source execution lock shared by every worker instance.
CREATE UNIQUE INDEX "SourceSyncJob_one_running_per_source" ON "SourceSyncJob"("sourceId") WHERE status='RUNNING';

ALTER TABLE "SourceSyncChange" ADD CONSTRAINT source_sync_change_check CHECK (
  outcome IN ('NEW_PRODUCT','EXISTING_PRODUCT','POSSIBLE_DUPLICATE','IDENTITY_CONFLICT','INSUFFICIENT_INFORMATION')
  AND severity IN ('CRITICAL','MATERIAL','ROUTINE')
  AND disposition IN ('PENDING_REVIEW','AUTO_APPLIED','RECORDED','ACKNOWLEDGED','DISMISSED','RESOLVED')
  AND "changeKey" ~ '^[a-f0-9]{64}$' AND btrim("recordId")<>''
  AND ("previousValue" IS NULL OR octet_length("previousValue"::text)<=8192)
  AND ("proposedValue" IS NULL OR octet_length("proposedValue"::text)<=8192)
);

ALTER TABLE "ProductOffer" ADD CONSTRAINT product_offer_check CHECK (
  "countryCode" ~ '^[A-Z]{2}$' AND (currency IS NULL OR currency ~ '^[A-Z]{3}$') AND ("previousCurrency" IS NULL OR "previousCurrency" ~ '^[A-Z]{3}$')
  AND (amount IS NULL OR (amount>0 AND currency IS NOT NULL)) AND ("previousAmount" IS NULL OR "previousAmount">0)
  AND ((size IS NULL)=("sizeSystem" IS NULL)) AND ("sizeSystem" IS NULL OR "sizeSystem" IN ('UK','US','EU','CM'))
  AND status IN ('ACTIVE','REMOVED') AND "sourceUrl" ~ '^https://[^@[:space:]]+$' AND btrim("listingKey")<>''
  AND "lastObservedAt">="firstSeenAt"
);
ALTER TABLE "ProductOfferObservation" ADD CONSTRAINT product_offer_observation_check CHECK (
  change IN ('INITIAL','PRICE_INCREASE','PRICE_DECREASE','CURRENCY_CHANGE','AVAILABILITY','PRICE_AND_AVAILABILITY','REFRESH','PRICE_MISSING','REMOVED')
  AND (amount IS NULL OR (amount>0 AND currency ~ '^[A-Z]{3}$')) AND "sourceUrl" ~ '^https://[^@[:space:]]+$'
);

ALTER TABLE "SourceAlert" ADD CONSTRAINT source_alert_check CHECK (
  kind IN ('REPEATED_FAILURES','AUTHORIZATION_EXPIRED','LONG_RUNNING_JOB','EXCESSIVE_CONFLICTS','FEED_SIZE_DROP','STALE_FEED','HIGH_REJECTION_RATE')
  AND severity IN ('PAGE','TICKET') AND status IN ('OPEN','ACKNOWLEDGED','RESOLVED')
  AND delivery IN ('LOGGED','NOT_CONFIGURED','FAILED') AND occurrences>0 AND btrim(message)<>''
);
-- One unresolved alert per condition; repeats increment occurrences instead of spamming.
CREATE UNIQUE INDEX "SourceAlert_open_dedupe" ON "SourceAlert"("dedupeKey") WHERE status<>'RESOLVED';

ALTER TABLE "SchedulerNonce" ADD CONSTRAINT scheduler_nonce_check CHECK (nonce ~ '^[A-Za-z0-9_-]{16,64}$');
COMMIT;
