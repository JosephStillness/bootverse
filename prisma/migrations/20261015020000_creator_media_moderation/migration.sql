-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "ImageState" AS ENUM ('UPLOADING', 'READY');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "region" VARCHAR(80),
    "specialization" VARCHAR(80) NOT NULL,
    "youtube" VARCHAR(500),
    "tiktok" VARCHAR(500),
    "instagram" VARCHAR(500),
    "website" VARCHAR(500),
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedImage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "slot" VARCHAR(10) NOT NULL,
    "profileId" TEXT,
    "creatorId" TEXT,
    "postId" TEXT,
    "reviewId" TEXT,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "state" "ImageState" NOT NULL DEFAULT 'UPLOADING',
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageDeletion" (
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageDeletion_pkey" PRIMARY KEY ("objectKey")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetKey" VARCHAR(180) NOT NULL,
    "reason" VARCHAR(30) NOT NULL,
    "explanation" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "postId" TEXT,
    "commentId" TEXT,
    "reviewId" TEXT,
    "imageId" TEXT,
    "creatorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "reportId" TEXT,
    "targetKey" VARCHAR(180) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorVerificationRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "challenge" VARCHAR(80) NOT NULL,
    "youtube" VARCHAR(500),
    "tiktok" VARCHAR(500),
    "instagram" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CreatorVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorVerificationDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "status" "VerificationStatus" NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "proofUrl" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorVerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorVideo" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "postId" TEXT,
    "reviewId" TEXT,
    "videoId" VARCHAR(11) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "sponsorship" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");

-- CreateIndex
CREATE INDEX "CreatorProfile_status_createdAt_id_idx" ON "CreatorProfile"("status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedImage_objectKey_key" ON "UploadedImage"("objectKey");

-- CreateIndex
CREATE INDEX "UploadedImage_ownerId_createdAt_idx" ON "UploadedImage"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedImage_profileId_idx" ON "UploadedImage"("profileId");

-- CreateIndex
CREATE INDEX "UploadedImage_creatorId_idx" ON "UploadedImage"("creatorId");

-- CreateIndex
CREATE INDEX "UploadedImage_postId_idx" ON "UploadedImage"("postId");

-- CreateIndex
CREATE INDEX "UploadedImage_reviewId_idx" ON "UploadedImage"("reviewId");

-- CreateIndex
CREATE INDEX "ContentReport_status_createdAt_id_idx" ON "ContentReport"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ContentReport_postId_idx" ON "ContentReport"("postId");

-- CreateIndex
CREATE INDEX "ContentReport_commentId_idx" ON "ContentReport"("commentId");

-- CreateIndex
CREATE INDEX "ContentReport_reviewId_idx" ON "ContentReport"("reviewId");

-- CreateIndex
CREATE INDEX "ContentReport_imageId_idx" ON "ContentReport"("imageId");

-- CreateIndex
CREATE INDEX "ContentReport_creatorId_idx" ON "ContentReport"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentReport_reporterId_targetKey_key" ON "ContentReport"("reporterId", "targetKey");

-- CreateIndex
CREATE INDEX "ModerationAction_createdAt_id_idx" ON "ModerationAction"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationAction_reportId_idx" ON "ModerationAction"("reportId");

-- CreateIndex
CREATE INDEX "ModerationAction_actorId_idx" ON "ModerationAction"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorVerificationRequest_challenge_key" ON "CreatorVerificationRequest"("challenge");

-- CreateIndex
CREATE INDEX "CreatorVerificationRequest_status_createdAt_id_idx" ON "CreatorVerificationRequest"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CreatorVerificationRequest_creatorId_idx" ON "CreatorVerificationRequest"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorVerificationDecision_requestId_createdAt_idx" ON "CreatorVerificationDecision"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorVerificationDecision_actorId_idx" ON "CreatorVerificationDecision"("actorId");

-- CreateIndex
CREATE INDEX "CreatorVideo_postId_idx" ON "CreatorVideo"("postId");

-- CreateIndex
CREATE INDEX "CreatorVideo_reviewId_idx" ON "CreatorVideo"("reviewId");

-- CreateIndex
CREATE INDEX "CreatorVideo_ownerId_idx" ON "CreatorVideo"("ownerId");

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "BootReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "BootReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "UploadedImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ContentReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVerificationRequest" ADD CONSTRAINT "CreatorVerificationRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVerificationDecision" ADD CONSTRAINT "CreatorVerificationDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CreatorVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVerificationDecision" ADD CONSTRAINT "CreatorVerificationDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVideo" ADD CONSTRAINT "CreatorVideo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVideo" ADD CONSTRAINT "CreatorVideo_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorVideo" ADD CONSTRAINT "CreatorVideo_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "BootReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every stored media/report row has a concrete, foreign-key-backed target.
ALTER TABLE "UploadedImage" ADD CONSTRAINT image_target CHECK (
 (slot='AVATAR' AND "profileId" IS NOT NULL OR slot='COVER' AND "creatorId" IS NOT NULL OR slot='POST' AND "postId" IS NOT NULL OR slot='REVIEW' AND "reviewId" IS NOT NULL)
 AND num_nonnulls("profileId","creatorId","postId","reviewId")=1
 AND bytes>0 AND width>0 AND height>0 AND "objectKey" ~ '^images/[0-9a-f-]{36}\.webp$');
ALTER TABLE "ContentReport" ADD CONSTRAINT report_target CHECK (
 num_nonnulls("postId","commentId","reviewId","imageId","creatorId")=1
 AND "targetKey"=CASE WHEN "postId" IS NOT NULL THEN 'POST:'||"postId" WHEN "commentId" IS NOT NULL THEN 'COMMENT:'||"commentId" WHEN "reviewId" IS NOT NULL THEN 'REVIEW:'||"reviewId" WHEN "imageId" IS NOT NULL THEN 'IMAGE:'||"imageId" ELSE 'CREATOR:'||"creatorId" END
 AND reason IN ('spam','harassment','offensive','misleading-review','copyright','inappropriate-image','other'));
ALTER TABLE "CreatorVideo" ADD CONSTRAINT video_target CHECK (num_nonnulls("postId","reviewId")=1 AND "videoId" ~ '^[A-Za-z0-9_-]{11}$');
CREATE UNIQUE INDEX creator_pending_request ON "CreatorVerificationRequest"("creatorId") WHERE status='PENDING';
CREATE FUNCTION queue_image_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "StorageDeletion"("objectKey") VALUES(OLD."objectKey") ON CONFLICT DO NOTHING;
 RETURN OLD;
END $$;
CREATE TRIGGER image_cleanup AFTER DELETE ON "UploadedImage" FOR EACH ROW EXECUTE FUNCTION queue_image_deletion();
-- Moderated comments remain as thread placeholders; only visible comments count.
CREATE OR REPLACE FUNCTION bootverse_comment_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW."postId"<>OLD."postId" OR NEW."parentCommentId" IS DISTINCT FROM OLD."parentCommentId" OR NEW."parentDepth" IS DISTINCT FROM OLD."parentDepth" OR NEW.depth<>OLD.depth THEN RAISE EXCEPTION 'Comment thread identity is immutable' USING ERRCODE='23514'; END IF;
  UPDATE "Post" SET "commentCount"="commentCount"+(CASE WHEN NEW."deletedAt" IS NULL AND NEW.status='PUBLISHED' THEN 1 ELSE 0 END)-(CASE WHEN OLD."deletedAt" IS NULL AND OLD.status='PUBLISHED' THEN 1 ELSE 0 END) WHERE id=NEW."postId";
 ELSIF TG_OP='INSERT' AND NEW."deletedAt" IS NULL AND NEW.status='PUBLISHED' THEN
  UPDATE "Post" SET "commentCount"="commentCount"+1 WHERE id=NEW."postId";
 ELSIF TG_OP='DELETE' AND OLD."deletedAt" IS NULL AND OLD.status='PUBLISHED' THEN
  UPDATE "Post" SET "commentCount"="commentCount"-1 WHERE id=OLD."postId";
 END IF;
 RETURN NULL;
END $$;
-- Existing ASCII handles remain valid; API validation further restricts Unicode letters/numbers.
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_username_format";
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_username_format" CHECK (char_length(username) BETWEEN 3 AND 30 AND username=normalize(username,NFC) AND username !~ '[/\\?#%[:space:][:cntrl:]]');
CREATE INDEX "UploadedImage_state_createdAt_idx" ON "UploadedImage"(state,"createdAt");
CREATE INDEX "StorageDeletion_createdAt_idx" ON "StorageDeletion"("createdAt");
CREATE UNIQUE INDEX "CreatorVideo_postId_videoId_key" ON "CreatorVideo"("postId","videoId");
CREATE UNIQUE INDEX "CreatorVideo_reviewId_videoId_key" ON "CreatorVideo"("reviewId","videoId");
ALTER TABLE "StorageDeletion" ADD CONSTRAINT storage_deletion_key CHECK ("objectKey" ~ '^images/[0-9a-f-]{36}\.webp$');
-- Self-disclosed sponsorship is displayed, never used as an aggregation weight.
ALTER TABLE "Post" ADD COLUMN sponsorship VARCHAR(120);
ALTER TABLE "BootReview" ADD COLUMN sponsorship VARCHAR(120);
