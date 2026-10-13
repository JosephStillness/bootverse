-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "BootBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BootBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootFamily" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BootFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootGeneration" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BootGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootTier" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BootTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootVariant" (
    "id" TEXT NOT NULL,
    "tierModelId" TEXT NOT NULL,
    "surface" VARCHAR(2),

    CONSTRAINT "BootVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootColorway" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "swatch" VARCHAR(7) NOT NULL,

    CONSTRAINT "BootColorway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "outsoleVariantId" TEXT NOT NULL,
    "colorwayId" TEXT NOT NULL,
    "sample" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CatalogueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostCategory" (
    "id" VARCHAR(30) NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "PostCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "bootEntryId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "name" VARCHAR(24) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateIndex
CREATE INDEX "BootFamily_brandId_idx" ON "BootFamily"("brandId");

-- CreateIndex
CREATE INDEX "BootGeneration_familyId_idx" ON "BootGeneration"("familyId");

-- CreateIndex
CREATE INDEX "BootTier_generationId_idx" ON "BootTier"("generationId");

-- CreateIndex
CREATE INDEX "BootVariant_tierModelId_idx" ON "BootVariant"("tierModelId");

-- CreateIndex
CREATE INDEX "BootColorway_generationId_idx" ON "BootColorway"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueEntry_slug_key" ON "CatalogueEntry"("slug");

-- CreateIndex
CREATE INDEX "CatalogueEntry_colorwayId_idx" ON "CatalogueEntry"("colorwayId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueEntry_outsoleVariantId_colorwayId_key" ON "CatalogueEntry"("outsoleVariantId", "colorwayId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_status_createdAt_id_idx" ON "Post"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_authorId_status_createdAt_idx" ON "Post"("authorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_categoryId_status_createdAt_idx" ON "Post"("categoryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_bootEntryId_status_createdAt_idx" ON "Post"("bootEntryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- AddForeignKey
ALTER TABLE "BootFamily" ADD CONSTRAINT "BootFamily_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BootBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BootGeneration" ADD CONSTRAINT "BootGeneration_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "BootFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BootTier" ADD CONSTRAINT "BootTier_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "BootGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BootVariant" ADD CONSTRAINT "BootVariant_tierModelId_fkey" FOREIGN KEY ("tierModelId") REFERENCES "BootTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BootColorway" ADD CONSTRAINT "BootColorway_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "BootGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_outsoleVariantId_fkey" FOREIGN KEY ("outsoleVariantId") REFERENCES "BootVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueEntry" ADD CONSTRAINT "CatalogueEntry_colorwayId_fkey" FOREIGN KEY ("colorwayId") REFERENCES "BootColorway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_bootEntryId_fkey" FOREIGN KEY ("bootEntryId") REFERENCES "CatalogueEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("name") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bounded public content and normalized identities, in addition to Zod validation.
ALTER TABLE "Post" ADD CONSTRAINT "Post_title_length" CHECK (char_length(btrim("title")) BETWEEN 5 AND 160);
ALTER TABLE "Post" ADD CONSTRAINT "Post_content_length" CHECK (char_length(btrim("content")) BETWEEN 20 AND 10000);
ALTER TABLE "Post" ADD CONSTRAINT "Post_version_positive" CHECK ("version" > 0);
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_format" CHECK ("name" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "BootVariant" ADD CONSTRAINT "BootVariant_surface" CHECK ("surface" IS NULL OR "surface" IN ('FG','AG','SG','TF'));
ALTER TABLE "PostCategory" ADD CONSTRAINT "PostCategory_supported" CHECK ("id" IN ('questions','boot-reviews','comparisons','sizing-help','general-discussion'));
INSERT INTO "PostCategory" ("id","name") VALUES
('questions','Questions'),('boot-reviews','Boot Reviews'),('comparisons','Comparisons'),('sizing-help','Sizing Help'),('general-discussion','General Discussion');
