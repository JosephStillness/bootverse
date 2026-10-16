-- CreateTable
CREATE TABLE "RecommendationEvidence" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "sourceKind" VARCHAR(20) NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecommendationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationEvidence_variantId_approved_observedAt_idx" ON "RecommendationEvidence"("variantId", "approved", "observedAt");

-- AddForeignKey
ALTER TABLE "RecommendationEvidence" ADD CONSTRAINT "RecommendationEvidence_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "BootVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "RecommendationEvidence"
  ADD CONSTRAINT "RecommendationEvidence_kind" CHECK (kind IN ('SURFACE','PRICE','AVAILABILITY','FIT')),
  ADD CONSTRAINT "RecommendationEvidence_source_kind" CHECK ("sourceKind" IN ('MANUFACTURER','RETAILER','MEASUREMENT','EDITORIAL','COMMUNITY')),
  ADD CONSTRAINT "RecommendationEvidence_dates" CHECK ("validUntil" > "observedAt"),
  ADD CONSTRAINT "RecommendationEvidence_https" CHECK ("sourceUrl" LIKE 'https://%'),
  ADD CONSTRAINT "RecommendationEvidence_payload" CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text) <= 16384);
