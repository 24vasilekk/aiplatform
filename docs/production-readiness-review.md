# Production Readiness Review (2026-04-02)

## Scope

- env readiness
- schema/migrations readiness
- monitoring and alerts
- backup and rollback plan
- final release gate status

## Review Summary

- Status: **not ready to deploy**
- Blockers:
  - production DB schema is behind code (`schema_behind_code`): latest applied migration is `20260401120000_part3_part4_ops`, expected is `20260402133000_performance_pass_indexes`.
- Residual risks:
  - in-memory rate limits are acceptable for single-instance deployments, but Redis/Upstash is recommended for multi-instance environments.
  - migration rollout must be coordinated with backup and rollback steps from runbook.

## Checklist

1. Environment readiness
- Added `env:check` (`scripts/env-readiness-check.mjs`) and integrated in CI.
- Added runtime env diagnostics in `GET /api/readiness` (`env` section with `ok/issues/missingRequired`).
- Added support flags:
  - `ENV_READINESS_MODE=strict|warn`
  - `ENV_READINESS_ENFORCE=1|0`
  - `ENV_READINESS_ENABLED=1|0`
- Result: pass in CI and local review.

2. Migrations and schema/code compatibility
- Existing gates confirmed:
  - `prisma migrate status`
  - `prisma migrate deploy`
  - `schema:check`
- Readiness endpoint already returns expected/applied migration version and compatibility.
- Result: release gate is active and currently blocks rollout in strict mode until migrations are applied.

3. Monitoring and alerts
- Existing structured request/error observability confirmed.
- Added metrics gauges in `/api/metrics?format=prom`:
  - `service_schema_readiness`
  - `service_env_readiness`
- Critical alert channel confirmed:
  - `CRITICAL_ALERT_WEBHOOK_URL`
- Result: sufficient baseline for production monitoring.

4. Backups and rollback
- Added explicit runbook commands for:
  - full backup (`pg_dump --format=custom`)
  - backup validation (`pg_restore --list`)
  - restore (`pg_restore --clean --if-exists`)
- Rollback strategy documented:
  - app rollback first
  - non-destructive DB strategy by default
- Result: rollback/restore procedure is operationally documented.

## Validation Runs

- `npm run env:check`
- `npm run schema:check`
- `npm test -- src/lib/env-readiness.test.ts src/app/api/readiness/route.test.ts`
- `npm test -- src/middleware.test.ts src/app/api/readiness/route.test.ts`
- `npm run lint`
- `npm run build`
- `npm run start` + `npm run smoke:api` (with `APP_URL` set)

Validation result summary:
- `env:check`: pass when required env is set.
- `lint/build/tests`: pass.
- smoke API: `health` pass, `readiness` returns `503 maintenance` with reason `schema_behind_code` (expected behavior while migrations are pending).

## Mandatory Pre-Deploy Step

1. Apply pending migrations to target environment:
   - `npm run prisma:generate`
   - `npm run prisma:migrate:deploy`
2. Re-run:
   - `npm run schema:check` (must return `ok: true`)
   - `npm run smoke:api` (must return `ok: true`)
