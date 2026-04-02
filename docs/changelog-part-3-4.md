# Changelog: Часть 3 и 4

## [2026-04-02] Stabilization & Release Gate

### Added

- env readiness gate:
  - `npm run env:check` (CLI preflight для production env)
  - расширенный `/api/readiness` с секцией `env` и флагом `enforce`
- schema readiness layer (`expectedVersion/appliedVersion`, compatibility status, runbook hints)
- maintenance mode:
  - API `503` с кодами `SCHEMA_NOT_READY` / `MAINTENANCE_MODE`
  - отдельная страница `/maintenance`
- CI workflow `release-check`:
  - `env:check`
  - `prisma migrate status`
  - `prisma migrate deploy`
  - `schema:check`
  - `lint/test/build`
  - smoke API checks
- новый `GET /api/admin/users/360` и расширенный User 360 UI (tabs/export/actions)
- API быстрых админ-действий для выдачи доступа (`/api/admin/users/access`)

### Changed

- `/api/metrics` теперь публикует readiness gauges:
  - `service_schema_readiness`
  - `service_env_readiness`
- `readiness` теперь отражает совместимость схемы и кода, а не только доступность БД
- `api-auth` и request-observer получили единый schema gate
- runbook и README дополнены release-check и schema readiness командами

### Fixed

- устранен build-blocker типизации в `tutor/lms/lessons/[lessonId]/files` (strict typed extensions)
- закрыты lint-ошибки в dashboard/tutor/loyalty integration tests
- добавлены недостающие тесты для readiness и admin access endpoints
- устранен P0 runtime-crash в Edge middleware (разорвана зависимость `middleware -> auth -> db -> attachment-ai`)

### Operational Notes

- в sandbox-окружениях без разрешения на bind-порт локальный smoke (`npm run smoke:api` + `next start`) может быть недоступен; в CI выполняется штатно
- перед прод-деплоем обязательно применить миграции `20260402011500...20260402133000`, иначе `/api/readiness` вернет `503 maintenance` (`schema_behind_code`)

## [2026-04-01] Final

### Added

- платежный контур: `create-checkout`, `pay-with-wallet`, `webhook`
- выдача доступов к курсам после успешной оплаты
- обработка failed/canceled платежей
- wallet: topup/debit/journal/idempotency
- прогресс ученика и API для кабинета/админки
- админ-аналитика покупок с фильтрами/CSV
- продуктовые метрики: DAU/WAU, retention, conversion, AI-активность
- дашборд «Финансы и продукт»
- структурированные логи и базовая observability
- admin audit log и error monitoring панель
- очередь `JobQueue` и ops API для фоновых задач
- retry/backoff для задач очереди
- read/write separation (`ReadOps`, `WriteOps`)
- расширенный автотестовый набор для критичных API/UI

### Changed

- dataset processing переведен в async mode через очередь (`202 Accepted` на upload)
- admin API списков переведены на пагинацию
- безопасные GET endpoint-ы получили cache policy
- admin page оптимизирована lazy-loading тяжелых блоков
- webhook security ужесточен (подпись через заголовок)

### Fixed

- `PricingAction` теперь отправляет JSON в checkout API
- устранены несовместимости тестовых моков после расширения audit/security
- выровнены статусы dataset processing (`uploaded/processing/parsed/ready/failed`)

### Technical Debt Cleanup

- унифицированы README и release docs без устаревших инструкций
- удалены противоречивые секции в README (дубли по Часть 2)
- добавлены эксплуатационные документы и единый runbook

### Breaking/Operational Notes

- для обработки очереди требуется регулярный запуск `run_pending` (cron/worker)
- рекомендуется миграция с in-memory rate-limit store на Redis/Upstash для multi-instance
