-- Tighten JSON/relational consistency without rewriting the already rehearsed D1 expansion.
-- PostgreSQL CHECK accepts NULL; explicitly reject an absent/null JSON entry identifier.
BEGIN;
ALTER TABLE "RecommendationEvidence" ADD CONSTRAINT "RecommendationEvidence_offer_entry_match" CHECK (
 "entryId" IS NULL OR (
  payload->'entryId' IS NOT NULL AND jsonb_typeof(payload->'entryId')='string'
  AND payload->>'entryId'="entryId"
 )
);
COMMIT;
