import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { bootData } from "../src/lib/boots/data";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
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
    for (const row of bootData.variants)
      await tx.bootVariant.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.colorways)
      await tx.bootColorway.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    for (const row of bootData.entries) {
      const { id, slug, outsoleVariantId, colorwayId, sample } = row;
      const identity = { id, slug, outsoleVariantId, colorwayId, sample };
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
