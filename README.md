# EGE AI Platform — MVP (Часть 1-4)

Рабочий MVP платформы подготовки к ЕГЭ (математика и физика) с платежами, прогрессом, аналитикой, observability и операционным контуром.

## Что в релизе Часть 3/4

- production-ready платежный контур: checkout, webhook, идемпотентность, статусы, выдача доступов
- кошелек/баланс: пополнение, списание, журнал транзакций, защита от двойного списания
- прогресс ученика: курс/урок/задание + API для кабинета и админки
- продуктовая и финансовая аналитика: DAU/WAU, конверсия, retention, покупки, дашборд
- observability: structured logs, request/correlation id, health/readiness, метрики
- security-hardening: rate limits, усиленные валидации, безопасные cookie, webhook hardening, admin audit log
- масштабирование: read/write separation, очереди тяжелых задач, retry/backoff, idempotency keys

## Технологии

- `Next.js 16` + `TypeScript` + `Tailwind CSS`
- `Prisma` + `PostgreSQL`
- JWT в HttpOnly cookie
- Vitest + Testing Library

## Быстрый старт

```bash
npm install
npx prisma generate
npx prisma db push --skip-generate
npm run dev
```

Открыть: `http://localhost:3000`

## Деплой на Vercel

По умолчанию проект уже настроен через [vercel.json](./vercel.json):

- install: `npm ci`
- build: `npm run build:vercel`

`build:vercel` выполняет:

1. `prisma generate`
2. `prisma migrate deploy`
3. `next build`

Если у вас legacy БД (раньше жили только на `db push`) и миграции падают, временно используйте fallback build command:

- `npm run build:vercel:fallback`

Если `migrate deploy` падает с `P3005`, выполните baseline один раз:

```bash
npm run prisma:migrate:baseline:part34
```

## Проверка качества

```bash
npm run lint
npm test
npm run build
```

## Релизные документы

- Часть 1: [docs/part-1.md](docs/part-1.md)
- Часть 2: [docs/part-2.md](docs/part-2.md)
- Часть 3: [docs/part-3.md](docs/part-3.md)
- Часть 4: [docs/part-4.md](docs/part-4.md)
- Финальный релиз 3/4: [docs/release-note-part-3-4.md](docs/release-note-part-3-4.md)
- Runbook (запуск/диагностика/восстановление): [docs/runbook-part-3-4.md](docs/runbook-part-3-4.md)
- Changelog: [docs/changelog-part-3-4.md](docs/changelog-part-3-4.md)
- Roadmap следующего этапа: [docs/roadmap-next-stage.md](docs/roadmap-next-stage.md)

## Админ-доступ

- Для роли admin зарегистрируйте аккаунт с email: `admin@ege.local`
- После входа откройте `/admin`

## Ключевые env-переменные

- База: `DATABASE_URL`
- JWT: `AUTH_JWT_SECRET`
- Приложение: `APP_URL`
- AI: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- OAuth/Telegram: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- Billing:
  - `BILLING_PROVIDER=yookassa` (fallback: `mock`)
  - `YOOKASSA_SHOP_ID`
  - `YOOKASSA_SECRET_KEY`
  - `BILLING_WEBHOOK_SECRET` (подпись `x-billing-signature`)
  - `MOCK_BILLING_AUTOCONFIRM=1` (демо)
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`
- OCR/PDF: `PDF_OCR_MAX_PAGES`

## Где хранятся данные

- PostgreSQL: бизнес-данные, события, платежи, очередь задач
- Файлы загрузок: `data/uploads`
- Файлы датасетов: `data/dataset-files`
