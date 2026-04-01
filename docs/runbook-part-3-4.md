# Runbook: Часть 3 и 4

## 1. Запуск

### 1.1 Локально

```bash
npm install
npx prisma generate
npx prisma db push --skip-generate
npm run dev
```

Проверка:

```bash
npm run lint
npm test
npm run build
```

### 1.2 Прод-миграции

Рекомендуемый порядок:

1. `npx prisma generate`
2. `npx prisma migrate deploy`
3. рестарт приложения

### 1.3 Vercel

Рекомендуемая конфигурация:

- Build Command: `npm run build:vercel`
- (уже задано в `vercel.json`)

Что делает `build:vercel`:

1. `prisma generate`
2. `next build`

Прод-миграции нужно запускать отдельным шагом (до или сразу после деплоя):

```bash
npm run deploy:migrate
```

Fallback (только для legacy БД, где миграции конфликтуют с уже созданными вручную таблицами):

- Build Command: `npm run build:vercel:fallback`
- В этом режиме после неуспешного `migrate deploy` выполняется `prisma db push --skip-generate`.

### 1.4 One-time baseline для legacy БД

Если видите `P3005 (database schema is not empty)` на `migrate deploy`, выполните один раз:

```bash
npm run prisma:migrate:baseline:part34
```

После этого используйте стандартный build command:

```bash
npm run build:vercel
```

## 2. Обязательные env

- `DATABASE_URL`
- `AUTH_JWT_SECRET`
- `APP_URL`
- `OPENROUTER_API_KEY` (или fallback-режим)
- billing: `BILLING_PROVIDER`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `BILLING_WEBHOOK_SECRET`

Опционально:

- `MOCK_BILLING_AUTOCONFIRM=1` (демо)
- `PDF_OCR_MAX_PAGES`
- SMTP-переменные для восстановления пароля

## 3. Операционный цикл очередей

Тяжелые задачи (пересчет метрик, процессинг dataset-файлов) работают через `JobQueue`.

### 3.1 Просмотр очереди

`GET /api/admin/ops/jobs?status=pending&take=30`

### 3.2 Поставить задачу на пересчет метрик

`POST /api/admin/ops/jobs`

```json
{
  "action": "enqueue_daily_metrics",
  "days": 30,
  "idempotencyKey": "daily_metrics:30:2026-04-01"
}
```

### 3.3 Поставить задачу process dataset

`POST /api/admin/ops/jobs`

```json
{
  "action": "enqueue_dataset_processing",
  "fileId": "<dataset-file-id>",
  "idempotencyKey": "dataset_process:<file-id>:manual"
}
```

### 3.4 Вычитать pending jobs

`POST /api/admin/ops/jobs`

```json
{
  "action": "run_pending",
  "limit": 3
}
```

## 4. Диагностика инцидентов

### 4.1 Платежи

Симптомы:

- не подтверждается оплата
- нет доступа к курсу после webhook

Проверить:

1. `BILLING_WEBHOOK_SECRET` и подпись `x-billing-signature`
2. статус в `PaymentIntent` + `PaymentEvent`
3. `CourseAccess` для пользователя
4. ошибки в `/api/admin/errors`

### 4.2 Dataset processing завис/failed

Проверить:

1. запись `DatasetFile.processingStatus`
2. наличие `dataset_file_process` job в `JobQueue`
3. `attempts/maxAttempts`, `lastError`, `runAt`
4. доступность системных утилит (PDF/OCR) и AI ключей

Действия:

- при `pending` и просроченном `runAt`: выполнить `run_pending`
- при `failed`: enqueue заново с новым `idempotencyKey`

### 4.3 Аналитика не обновляется

Проверить:

1. свежие события в `AnalyticsEvent`
2. daily aggregates (`DailyMetricAggregate`)
3. jobs типа `daily_metrics_recompute`

## 5. Восстановление

### 5.1 Быстрый rollback (приложение)

1. откат на предыдущий релиз образа/коммита
2. оставить БД без destructive rollback
3. выключить ops-действия для ручного enqueue до стабилизации

### 5.2 Частичное восстановление очереди

1. зафиксировать ошибку в `ServiceError`
2. для критичных задач повторно enqueue с уникальным `idempotencyKey`
3. запускать `run_pending` малыми батчами (`limit=1..3`)

### 5.3 Проверка после восстановления

- `health` = ok
- `readiness` = ready
- `npm test` локально/CI
- smoke сценарии:
  - checkout + webhook
  - wallet topup + purchase
  - progress update
  - admin analytics summary

## 6. SLO/алерты (база)

Минимальные пороги:

- 5xx на `/api/billing/*` > 2% за 5 минут
- `JobQueue` pending старше 15 минут > 20 задач
- `JobQueue` failed > 5 задач за 10 минут
- readiness != ready > 2 минуты
