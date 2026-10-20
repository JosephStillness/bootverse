-- Run with a privately configured direct PostgreSQL service on the APPROVED staging target.
-- No application/private user rows are selected. This script never migrates or seeds.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT current_database(), current_setting('server_version'), current_setting('TimeZone');
SELECT migration_name, finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM "_prisma_migrations" ORDER BY migration_name;
SELECT count(*) AS not_validated_constraints
FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated;
SELECT count(*) AS invalid_indexes
FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
WHERE t.relnamespace='public'::regnamespace AND NOT i.indisvalid;
SELECT count(*) AS inconsistent_catalogue_generations
FROM "CatalogueEntry" e JOIN "BootVariant" v ON v.id=e."outsoleVariantId"
JOIN "BootColorway" c ON c.id=e."colorwayId"
WHERE e."generationId"<>v."generationId" OR e."generationId"<>c."generationId";
SELECT "published", "sample", count(*) FROM "CatalogueEntry" GROUP BY "published", "sample";
COMMIT;
