-- Preserve UTC values written by Prisma while making future timestamps timezone-safe.
ALTER TABLE "User" ALTER COLUMN "emailVerified" TYPE TIMESTAMPTZ(3) USING "emailVerified" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "UserProfile" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "UserProfile" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Session" ALTER COLUMN "expires" TYPE TIMESTAMPTZ(3) USING "expires" AT TIME ZONE 'UTC';
ALTER TABLE "VerificationToken" ALTER COLUMN "expires" TYPE TIMESTAMPTZ(3) USING "expires" AT TIME ZONE 'UTC';
ALTER TABLE "RateLimit" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
