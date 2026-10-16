-- Additive only. Existing reviews are not opted in, and no measurements are copied from FootProfile.
ALTER TABLE "BootReview"
 ADD COLUMN "analysisConsent" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "analysisConsentAt" TIMESTAMPTZ(3),
 ADD COLUMN "reviewInstep" VARCHAR(16),
 ADD COLUMN "reviewFitSensation" VARCHAR(20),
 ADD COLUMN "toeRoomCategory" VARCHAR(16),
 ADD COLUMN "heelLockdownCategory" VARCHAR(16),
 ADD COLUMN "breakInCategory" VARCHAR(24),
 ADD CONSTRAINT "BootReview_analysis_consent_check" CHECK (
   ("analysisConsent" = ("analysisConsentAt" IS NOT NULL)) AND (NOT "analysisConsent" OR "shareFootInfo")
 ),
 ADD CONSTRAINT "BootReview_analysis_categories_check" CHECK (
   ("reviewInstep" IS NULL OR "reviewInstep" IN ('Low','Medium','High','Unsure')) AND
   ("reviewFitSensation" IS NULL OR "reviewFitSensation" IN ('Barefoot-like','Cushioned','Structured','Unsure')) AND
   ("toeRoomCategory" IS NULL OR "toeRoomCategory" IN ('tight','expected','roomy')) AND
   ("heelLockdownCategory" IS NULL OR "heelLockdownCategory" IN ('loose','secure','pressure')) AND
   ("breakInCategory" IS NULL OR "breakInCategory" IN ('none','under-3-sessions','3-10-sessions','over-10-sessions','not-completed'))
 );
CREATE INDEX "BootReview_variantId_status_analysisConsent_id_idx" ON "BootReview"("variantId","status","analysisConsent",id);
