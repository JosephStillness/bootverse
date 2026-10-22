import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { bootData } from "../src/lib/boots/data";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const target=new URL(process.env.DATABASE_URL);
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(target.hostname))throw Error('Sample imports are development-only and require a localhost database.');
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    pipeline: true,
    options: "-c timezone=UTC",
  }),
});
try {
  // Fixtures are validated on import. Only catalogue identities are copied; no community content.
  await db.$transaction(async (tx) => {
    for (const row of bootData.brands)
      await tx.bootBrand.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.families)
      await tx.bootFamily.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.generations)
      await tx.bootGeneration.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.tiers)
      await tx.bootTier.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.variants) {
      const generationId = bootData.tiers.find(
        (tier) => tier.id === row.tierModelId,
      )!.generationId;
      const identity = { ...row, generationId };
      await tx.bootVariant.upsert({
        where: { id: row.id },
        create: identity,
        update: identity,
      });
    }
    for (const row of bootData.colorways)
      await tx.bootColorway.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.entries) {
      const { id, slug, outsoleVariantId, colorwayId, sample } = row;
      const generationId = bootData.colorways.find(
        (colorway) => colorway.id === colorwayId,
      )!.generationId;
      const identity = {
        id,
        slug,
        outsoleVariantId,
        colorwayId,
        generationId,
        sample,
        published:true,
      };
      await tx.catalogueEntry.upsert({
        where: { id },
        create: identity,
        update: identity,
      });
    }
  });
  console.log(
    `Imported ${bootData.entries.length} clearly labeled sample catalogue identities. No users or posts were seeded.`,
  );
} finally {
  await db.$disconnect();
}
