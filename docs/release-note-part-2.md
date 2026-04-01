# Release Note: Часть 2

Дата: 1 апреля 2026

## Что сделано

- Соцлогин:
  - Google OAuth (`/api/auth/google/login`, `/api/auth/google/callback`)
  - Telegram login callback (`/api/auth/telegram/callback`) с проверкой подписи
  - Линковка/создание пользователя для OAuth-аккаунтов
  - Единый UI входа: email/password + Google + Telegram
- Безопасность:
  - rate limit для auth endpoints
  - строгая валидация payload (JSON content type + schema checks)
  - усиленная проверка `state` в OAuth
  - безопасный `returnTo/next` redirect только на внутренние пути
- Блог:
  - сущность `Post` в Prisma
  - admin CRUD API для постов
  - admin UI управления блогом (создание/редактирование/публикация/фильтр)
  - публичные страницы `/blog` и `/blog/[slug]` с SSR/metadata
  - SEO: `sitemap`, `robots`, canonical, OpenGraph/Twitter, JSON-LD `Article`
- Аналитика Часть 2:
  - события `login_success`, `login_failed`, `blog_post_view`, `blog_post_share`
  - виджет в админке: регистрации по каналам + просмотры блога (7/30 дней)
- Тесты:
  - базовые unit/integration тесты auth/blog/API/UI-сценариев

## Что проверено

- Локальные проверки:
  - `npm test` — тесты проходят
  - `npm run lint` — без ошибок (только warning’и)
  - `npm run build` — собирается (ранее зафиксировано)
- Функциональные сценарии:
  - login email/password
  - login Google/Telegram
  - создание/редактирование/публикация постов
  - видимость только опубликованных постов в публичном блоге
  - генерация SEO-метаданных и sitemap/robots
- Нефункциональные проверки:
  - rate limit и корректные 429-ответы на auth
  - обработка `account_exists` и ошибок OAuth в UI

## Ограничения и остаточные риски

- Rate limit реализован in-memory:
  - подходит для MVP/одиночного инстанса
  - для multi-instance production нужен Redis/edge KV
- Telegram Login Widget зависит от корректной настройки домена в `@BotFather`.
- В публичных блог-страницах используется `<img>` (warning линтера по `next/image`).
- Для полного production hardening желательно:
  - вынести feature flags для оперативного отключения соцлогина
  - централизовать audit/security logs
  - добавить e2e smoke tests на внешние OAuth-провайдеры
