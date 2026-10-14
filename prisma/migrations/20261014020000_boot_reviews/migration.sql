-- CreateTable
CREATE TABLE "BootReview" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sizeWorn" VARCHAR(12) NOT NULL,
    "sizeSystem" VARCHAR(4) NOT NULL,
    "ownershipMonths" INTEGER NOT NULL,
    "matchesPlayed" INTEGER NOT NULL,
    "experience" TEXT NOT NULL,
    "pros" TEXT NOT NULL,
    "cons" TEXT NOT NULL,
    "comfort" INTEGER NOT NULL,
    "fit" INTEGER NOT NULL,
    "traction" INTEGER NOT NULL,
    "ballTouch" INTEGER NOT NULL,
    "durability" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "ratingTotal" INTEGER NOT NULL,
    "footLengthCm" DECIMAL(4,1),
    "footWidthCm" DECIMAL(4,1),
    "footShape" VARCHAR(20),
    "shareFootInfo" BOOLEAN NOT NULL DEFAULT false,
    "position" VARCHAR(50),
    "playingSurface" VARCHAR(4),
    "widthObservation" VARCHAR(30),
    "toeRoom" VARCHAR(300),
    "midfootPressure" VARCHAR(300),
    "heelLockdown" VARCHAR(300),
    "breakIn" VARCHAR(300),
    "purchasePrice" DECIMAL(10,2),
    "currency" VARCHAR(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BootReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHelpfulVote" (
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHelpfulVote_pkey" PRIMARY KEY ("reviewId","userId")
);

-- CreateIndex
CREATE INDEX "BootReview_variantId_status_createdAt_id_idx" ON "BootReview"("variantId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "BootReview_variantId_status_ratingTotal_createdAt_id_idx" ON "BootReview"("variantId", "status", "ratingTotal", "createdAt", "id");

-- CreateIndex
CREATE INDEX "BootReview_authorId_status_createdAt_id_idx" ON "BootReview"("authorId", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BootReview_authorId_variantId_key" ON "BootReview"("authorId", "variantId");

-- CreateIndex
CREATE INDEX "ReviewHelpfulVote_userId_idx" ON "ReviewHelpfulVote"("userId");

-- AddForeignKey
ALTER TABLE "BootReview" ADD CONSTRAINT "BootReview_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "BootVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BootReview" ADD CONSTRAINT "BootReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulVote" ADD CONSTRAINT "ReviewHelpfulVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "BootReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulVote" ADD CONSTRAINT "ReviewHelpfulVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "BootReview" ADD CONSTRAINT "BootReview_ratings_check" CHECK (
  comfort BETWEEN 1 AND 5 AND fit BETWEEN 1 AND 5 AND traction BETWEEN 1 AND 5
  AND "ballTouch" BETWEEN 1 AND 5 AND durability BETWEEN 1 AND 5 AND value BETWEEN 1 AND 5
  AND "ratingTotal" = comfort + fit + traction + "ballTouch" + durability + value);
ALTER TABLE "BootReview" ADD CONSTRAINT "BootReview_fields_check" CHECK (
  version > 0 AND "ownershipMonths" BETWEEN 0 AND 600 AND "matchesPlayed" BETWEEN 0 AND 10000
  AND "sizeSystem" IN ('UK','US','EU','CM') AND "sizeWorn" ~ '^([0-9]{1,3})(\.(0|5))?$'
  AND "sizeWorn"::numeric > 0 AND "sizeWorn"::numeric <= 100
  AND length(btrim(experience)) BETWEEN 40 AND 5000 AND length(btrim(pros)) BETWEEN 3 AND 1500 AND length(btrim(cons)) BETWEEN 3 AND 1500
  AND ("footLengthCm" IS NULL OR "footLengthCm" BETWEEN 10 AND 40)
  AND ("footWidthCm" IS NULL OR "footWidthCm" BETWEEN 3 AND 20)
  AND ("footShape" IS NULL OR "footShape" IN ('narrow','average','wide','unsure'))
  AND ("playingSurface" IS NULL OR "playingSurface" IN ('FG','AG','TF','SG','IN','OTHER'))
  AND ("widthObservation" IS NULL OR "widthObservation" IN ('too-narrow','slightly-narrow','expected','slightly-wide','too-wide'))
  AND (("purchasePrice" IS NULL AND currency IS NULL) OR ("purchasePrice" IS NOT NULL AND "purchasePrice" >= 0 AND currency IS NOT NULL AND currency ~ '^[A-Z]{3}$')));
CREATE FUNCTION boot_review_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW."variantId" <> OLD."variantId" OR NEW."authorId" <> OLD."authorId" THEN
    RAISE EXCEPTION 'Review identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER boot_review_identity BEFORE UPDATE ON "BootReview" FOR EACH ROW EXECUTE FUNCTION boot_review_identity_immutable();
CREATE FUNCTION review_helpful_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."userId" = (SELECT "authorId" FROM "BootReview" WHERE id = NEW."reviewId") THEN
    RAISE EXCEPTION 'Authors cannot vote on their own review';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER review_helpful_guard BEFORE INSERT OR UPDATE ON "ReviewHelpfulVote" FOR EACH ROW EXECUTE FUNCTION review_helpful_guard();
