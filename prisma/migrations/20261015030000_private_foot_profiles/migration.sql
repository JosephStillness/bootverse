-- CreateTable
CREATE TABLE "FootProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leftLengthMm" DECIMAL(6,2),
    "rightLengthMm" DECIMAL(6,2),
    "leftWidthMm" DECIMAL(6,2),
    "rightWidthMm" DECIMAL(6,2),
    "measuredOn" DATE,
    "measurementMethod" VARCHAR(200),
    "footShape" VARCHAR(20),
    "instep" VARCHAR(20),
    "arch" VARCHAR(20),
    "toePreference" VARCHAR(20),
    "heelPreference" VARCHAR(20),
    "snugness" VARCHAR(20),
    "fitSensation" VARCHAR(20),
    "primaryPosition" VARCHAR(10),
    "secondaryPositions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "surface" VARCHAR(2),
    "budgetAmount" DECIMAL(9,2),
    "currency" VARCHAR(3),
    "preferredBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizeWorn" DECIMAL(4,2),
    "sizeSystem" VARCHAR(4),
    "allowFitFinder" BOOLEAN NOT NULL DEFAULT false,
    "fitFinderConsentAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FootProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FootProfile_userId_key" ON "FootProfile"("userId");

-- AddForeignKey
ALTER TABLE "FootProfile" ADD CONSTRAINT "FootProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Input guardrails only, not medical or boot-fit classifications.
ALTER TABLE "FootProfile"
  ADD CONSTRAINT "FootProfile_length_bounds" CHECK (("leftLengthMm" IS NULL OR "leftLengthMm" BETWEEN 80 AND 400) AND ("rightLengthMm" IS NULL OR "rightLengthMm" BETWEEN 80 AND 400)),
  ADD CONSTRAINT "FootProfile_width_bounds" CHECK (("leftWidthMm" IS NULL OR "leftWidthMm" BETWEEN 30 AND 180) AND ("rightWidthMm" IS NULL OR "rightWidthMm" BETWEEN 30 AND 180)),
  ADD CONSTRAINT "FootProfile_budget" CHECK (("budgetAmount" IS NULL) = (currency IS NULL) AND ("budgetAmount" IS NULL OR "budgetAmount" BETWEEN 0 AND 1000000) AND (currency IS NULL OR currency ~ '^[A-Z]{3}$')),
  ADD CONSTRAINT "FootProfile_size" CHECK (("sizeWorn" IS NULL) = ("sizeSystem" IS NULL) AND ("sizeWorn" IS NULL OR "sizeWorn" > 0 AND "sizeWorn" <= 60) AND ("sizeSystem" IS NULL OR "sizeSystem" IN ('UK','US','EU','CM'))),
  ADD CONSTRAINT "FootProfile_surface" CHECK (surface IS NULL OR surface IN ('FG','AG','TF','SG','IN')),
  ADD CONSTRAINT "FootProfile_consent" CHECK ("allowFitFinder" = ("fitFinderConsentAt" IS NOT NULL)),
  ADD CONSTRAINT "FootProfile_version" CHECK (version > 0),
  ADD CONSTRAINT "FootProfile_date" CHECK ("measuredOn" IS NULL OR "measuredOn" BETWEEN DATE '1900-01-01' AND (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
  ADD CONSTRAINT "FootProfile_shape" CHECK ("footShape" IS NULL OR "footShape" IN ('Narrow','Regular','Wide','Unsure')),
  ADD CONSTRAINT "FootProfile_instep" CHECK (instep IS NULL OR instep IN ('Low','Medium','High','Unsure')),
  ADD CONSTRAINT "FootProfile_arch" CHECK (arch IS NULL OR arch IN ('Low','Neutral','High','Unsure')),
  ADD CONSTRAINT "FootProfile_toe" CHECK ("toePreference" IS NULL OR "toePreference" IN ('Close','Roomy','Unsure')),
  ADD CONSTRAINT "FootProfile_heel" CHECK ("heelPreference" IS NULL OR "heelPreference" IN ('Secure','Relaxed','Unsure')),
  ADD CONSTRAINT "FootProfile_snugness" CHECK (snugness IS NULL OR snugness IN ('Snug','Balanced','Relaxed','Unsure')),
  ADD CONSTRAINT "FootProfile_sensation" CHECK ("fitSensation" IS NULL OR "fitSensation" IN ('Barefoot-like','Cushioned','Structured','Unsure')),
  ADD CONSTRAINT "FootProfile_positions" CHECK (("primaryPosition" IS NULL OR "primaryPosition" IN ('GK','DEF','MID','FWD','OTHER')) AND "secondaryPositions" <@ ARRAY['GK','DEF','MID','FWD','OTHER']::text[] AND cardinality("secondaryPositions") <= 5 AND ("primaryPosition" IS NULL OR NOT "primaryPosition" = ANY("secondaryPositions"))),
  ADD CONSTRAINT "FootProfile_preferences_limit" CHECK (cardinality("preferredBrands") <= 12 AND cardinality("preferredTiers") <= 12);
