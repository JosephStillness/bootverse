BEGIN;
-- D4 product approval: additive only. No existing row is published, merged or removed.

ALTER TABLE "CatalogueEntry" ADD COLUMN "submittedAt" TIMESTAMPTZ(3);
CREATE INDEX "CatalogueEntry_status_submittedAt_id_idx" ON "CatalogueEntry"("status", "submittedAt", "id");

CREATE TABLE "ProductReviewDecision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "entryKey" VARCHAR(100) NOT NULL,
    "actorId" TEXT,
    "kind" VARCHAR(24) NOT NULL,
    "fromStatus" "ProductPublicationStatus",
    "toStatus" "ProductPublicationStatus",
    "reason" VARCHAR(2000) NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "entryVersion" INTEGER NOT NULL,
    "reviewFingerprint" VARCHAR(64),
    "requestKey" VARCHAR(160),
    "requestHash" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductReviewDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductReviewDecision_requestKey_key" ON "ProductReviewDecision"("requestKey");
CREATE INDEX "ProductReviewDecision_entryId_createdAt_id_idx" ON "ProductReviewDecision"("entryId", "createdAt", "id");
CREATE INDEX "ProductReviewDecision_entryId_kind_createdAt_idx" ON "ProductReviewDecision"("entryId", "kind", "createdAt");
CREATE INDEX "ProductReviewDecision_kind_createdAt_id_idx" ON "ProductReviewDecision"("kind", "createdAt", "id");
CREATE INDEX "ProductReviewDecision_actorId_idx" ON "ProductReviewDecision"("actorId");
ALTER TABLE "ProductReviewDecision" ADD CONSTRAINT "ProductReviewDecision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductReviewDecision" ADD CONSTRAINT "ProductReviewDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductReviewDecision" ADD CONSTRAINT product_review_decision_check CHECK (
  kind IN ('SUBMIT','APPROVE','REJECT','RETURN','REOPEN','ARCHIVE','RESUBMIT','NOTE','CONFLICT_RESOLUTION','DUPLICATE_RESOLUTION')
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

CREATE TABLE "ProductRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "actorId" TEXT,
    "decisionId" TEXT,
    "reason" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductRevision_entryId_revision_key" ON "ProductRevision"("entryId", "revision");
CREATE INDEX "ProductRevision_decisionId_idx" ON "ProductRevision"("decisionId");
CREATE INDEX "ProductRevision_actorId_idx" ON "ProductRevision"("actorId");
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CatalogueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ProductReviewDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductRevision" ADD CONSTRAINT product_revision_check CHECK (
  revision>0 AND "snapshotHash" ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=262144
  AND char_length(btrim(reason)) BETWEEN 10 AND 2000
);

-- Audit tamper protection. Direct UPDATE/DELETE is refused; only referential
-- actions fired by a parent deletion (trigger depth > 1) may null a foreign key
-- on decisions or cascade-remove a deleted product's revisions.
CREATE FUNCTION bootverse_review_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP='DELETE' AND TG_TABLE_NAME='ProductRevision' THEN RETURN OLD; END IF;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW) - 'entryId' - 'actorId' - 'decisionId')=(to_jsonb(OLD) - 'entryId' - 'actorId' - 'decisionId')
      AND (NEW."entryId" IS NULL OR NEW."entryId"=OLD."entryId")
      AND (NEW."actorId" IS NULL OR NEW."actorId"=OLD."actorId") THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Product review history is append-only.' USING ERRCODE='42501';
END $$;
CREATE TRIGGER product_review_decision_append_only BEFORE UPDATE OR DELETE ON "ProductReviewDecision" FOR EACH ROW EXECUTE FUNCTION bootverse_review_audit_guard();
CREATE TRIGGER product_revision_append_only BEFORE UPDATE OR DELETE ON "ProductRevision" FOR EACH ROW EXECUTE FUNCTION bootverse_review_audit_guard();
COMMIT;
