# EGE AI Platform — MVP

Рабочий MVP платформы подготовки к ЕГЭ (математика и физика).

## Реализовано

- Регистрация и вход по `email + пароль`
- Выход из аккаунта
- Полноценное восстановление пароля (`forgot` + одноразовый токен + `reset`)
- Личный кабинет с доступными/закрытыми курсами
- Структура `Курс -> Раздел -> Урок`
- Страница урока: видео + задания + AI-чат
- Общий AI-чат
- Оплата через `payment intent`-логику (готово к подключению внешней платежки)
- Ограничение доступа к курсам без оплаты
- Базовая админ-страница и защищенные admin API
- Админ CRUD для курсов/разделов/уроков (создание, редактирование, удаление)
- Загрузка фото/файлов в чат, OCR для изображений, извлечение текста и проверка таймкодов

## Технологии

- `Next.js 16` + `TypeScript` + `Tailwind CSS`
- JWT в HttpOnly cookie
- `Prisma` + `SQLite` (`DATABASE_URL`)

## Быстрый старт

```bash
npm install
npx prisma generate
npx prisma db push --skip-generate
npm run dev
```

Открыть: `http://localhost:3000`

## Проверка

```bash
npm run lint
npm run build
```

## Демо-флоу

1. Зарегистрируйтесь на `/register`
2. В кабинете откройте курс математики (доступ выдается автоматически)
3. Для остальных курсов перейдите на `/pricing` и нажмите `Оплатить`
4. Откройте урок, решите задания, попробуйте AI-чат

## Админ-доступ

- Для роли admin зарегистрируйте аккаунт с email: `admin@ege.local`
- После входа откройте `/admin`

## Где данные

- БД: `DATABASE_URL` (по умолчанию `file:/tmp/ege-mvp-dev.db`)
- Загруженные файлы: `data/uploads`

## OpenRouter (AI)

1. В `.env` укажите:
   - `OPENROUTER_API_KEY=ваш_ключ`
   - `OPENROUTER_MODEL=модель` (по умолчанию `openai/gpt-4o-mini`)
2. Перезапустите dev-сервер.

Если ключ не задан, AI работает в fallback-режиме с локальными демо-ответами.

## SMTP (восстановление пароля)

Для прод-отправки писем добавьте в `.env`:

- `APP_URL=https://ваш-домен`
- `SMTP_HOST=...`
- `SMTP_PORT=587`
- `SMTP_USER=...`
- `SMTP_PASS=...`
- `SMTP_FROM=EGE AI <no-reply@your-domain>`
- `SMTP_SECURE=0` (или `1` для SSL/465)

## Billing Provider

- `BILLING_PROVIDER=mock` (по умолчанию), можно переключить на `yookassa`/`stripe`
- `BILLING_WEBHOOK_SECRET=...`
- `MOCK_BILLING_AUTOCONFIRM=1` (для демо-подтверждения)

## PDF OCR

- По умолчанию OCR fallback пытается обработать весь PDF.
- Для ограничения страниц можно задать `PDF_OCR_MAX_PAGES=...`.
