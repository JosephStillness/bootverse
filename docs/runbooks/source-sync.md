# Runbook: product source synchronization (D5)

All alerts appear on `/admin/data-sources/<id>` and as `source_alert` JSON lines in the application log. Severity: **PAGE** = act now, **TICKET** = act this week. Logs for one run share `requestId` (the job ID) and name their `entryPoint` (`scheduler`, `cli`, `admin`, `internal_endpoint`).

First query for any alert (local or approved environment only):

```sql
SELECT id, status, "entryPoint", "startedAt", "durationMs", "errorCategory", summary
FROM "SourceSyncJob" WHERE "sourceId" = '<source id>' ORDER BY "startedAt" DESC LIMIT 10;
```

## repeated-failures
**Means:** the source failed `SYNC_FAILING_AFTER` (default 3) runs in a row; scheduled runs are backing off exponentially.
**First check:** the jobs' `errorCategory`. TIMEOUT/UNAVAILABLE → provider outage, wait; INVALID_FEED → provider format change, preview the feed (`npm run sync:run -- <id> --preview`); DATABASE/BUSY → local infrastructure.
**Escalate to:** data pipeline owner; the provider contact recorded in the source registry for provider-side faults.

## authorization-expired
**Means:** the provider rejected the credentials (401/403), or the source's documented permission is missing or older than `SYNC_AUTHORIZATION_REVIEW_DAYS`. Sync is paused; it will not retry quickly.
**First check:** the source registry entry (authorization status, permission reference, last check). Confirm permission in writing before re-checking it; rotate the server-side credential if it was revoked.
**Escalate to:** whoever owns the provider agreement. Never work around a 401/403.

## long-running-job
**Means:** a job has been RUNNING longer than `SYNC_LONG_RUNNING_MINUTES`.
**First check:** whether the worker process is alive. If not, its lease expires within `SYNC_LEASE_MINUTES` and the next run or `npm run sync:sweep` marks it ABANDONED automatically. Do not delete job rows.
**Escalate to:** platform on-call if leases are not being recovered.

## excessive-conflicts
**Means:** one run reported more critical identity/outsole/SKU changes than max(10, 10% of products).
**First check:** `/admin/products/review?quality=sync_changes`. A sudden spike usually means the provider changed identifiers or labels; consider disabling scheduled sync for the source until clarified.
**Escalate to:** catalogue reviewers; the provider for identifier changes.

## feed-size-drop
**Means:** a complete (SNAPSHOT) feed shrank by more than half versus the previous successful run. Missing listings were only noted (`missingSince`), never marked out of stock.
**First check:** preview the feed and compare record counts; check whether the provider switched to a partial export.
**Escalate to:** the provider if the export is broken.

## stale-feed
**Means:** no successful sync for more than `SYNC_STALE_FEED_MULTIPLIER` × the interval. Prices from this source drop off public pages when their evidence expires (`SYNC_PRICE_EVIDENCE_HOURS`).
**First check:** is the scheduler running (`sync:due` invocations in logs)? Is the source backing off (`backoffUntil`)?
**Escalate to:** platform on-call for scheduler problems.

## high-rejection-rate
**Means:** more than 20% of records failed validation. More than `SYNC_MAX_REJECT_RATE` (default 50%) aborts the run with nothing written.
**First check:** the row diagnostics of the run's import batch (`batchId` on the job row; report at `/api/admin/product-imports/<batchId>`).
**Escalate to:** the provider with the diagnostic codes (never with internal data).
