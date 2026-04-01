# Часть 4: Эксплуатационная устойчивость и масштабирование

## Цель

Добавить операционный контур для управляемого роста нагрузки:

- фоновая обработка агрегатов через очередь,
- audit trail админ-действий,
- централизованный журнал сервисных ошибок,
- снижение лишней нагрузки на каталог курсов.

## Архитектурные решения

1. **Очередь задач в БД (`JobQueue`)**
   - Поддержаны состояния: `pending/processing/succeeded/failed`.
   - Добавлены helper-функции:
     - `enqueueJob`
     - `listJobs`
     - `executePendingJobs`
   - Job types:
     - `daily_metrics_recompute`
     - `dataset_file_process`
   - Реализован retry/backoff с jitter и учетом `maxAttempts`.

2. **Admin Ops API**
   - `GET /api/admin/ops/jobs` — просмотр очереди.
   - `POST /api/admin/ops/jobs`:
     - `enqueue_daily_metrics`
     - `enqueue_dataset_processing`
     - `run_pending`
   - Поддержка идемпотентных постановок задач (`idempotencyKey`, `x-idempotency-key`).

3. **Наблюдаемость**
   - `AdminAuditLog`:
     - логирование админ-мутаций (создание уроков/заданий),
     - логирование ops-действий по очереди.
   - `ServiceError`:
     - best-effort запись ошибок в критичных роутах (AI analyze, admin ops, admin mutations).

4. **Оптимизация чтений каталога**
   - Добавлен lightweight TTL cache (30s) в `course-catalog`:
     - курсы,
     - разделы по курсу,
     - уроки по разделу,
     - урок по id.

5. **Read/Write separation**
   - Введены слои:
     - `ReadOps` для read-heavy операций
     - `WriteOps` для мутаций и enqueue
   - API-маршруты переведены на явное разделение чтения и записи.

6. **Async process для тяжелых задач**
   - Upload dataset-файла возвращает `202 Accepted`.
   - OCR/извлечение/чанкинг выполняются в фоне через `dataset_file_process`.
   - Статусы dataset-файла: `uploaded/processing/parsed/ready/failed`.

## Миграция

Добавлена миграция:

- `prisma/migrations/20260401120000_part3_part4_ops/migration.sql`
- `prisma/migrations/20260401143000_performance_hardening_indexes/migration.sql`

Создает/индексирует:

- `DailyMetricAggregate`
- `AdminAuditLog`
- `ServiceError`
- `JobQueue`
- индекс `AnalyticsEvent_eventName_userId_createdAt_idx`
- дополнительные индексы для payments/wallet/errors/analytics/admin-audit
