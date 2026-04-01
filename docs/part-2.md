# Часть 2: Соцлогин + Блог + SEO

Документ описывает запуск локально, env-переменные, деплой-чеклист и rollback-план.

## Env-переменные

### Обязательные

- `DATABASE_URL` — PostgreSQL
- `AUTH_JWT_SECRET` — секрет для JWT (должен быть уникальным для окружения)
- `APP_URL` — базовый URL приложения (`http://localhost:3000` локально, прод-домен в production)

### Google OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (опционально)
  - если пустой, используется `${APP_URL}/api/auth/google/callback`
  - локально обычно: `http://localhost:3000/api/auth/google/callback`

### Telegram Login

- `TELEGRAM_BOT_TOKEN`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (без `@`)

Важно: в `@BotFather` нужно добавить ваш домен в настройки Login Widget, иначе подпись/данные Telegram не пройдут проверку.

## Локальный запуск (блог + соцлогин)

1. Скопировать `.env.example` в `.env` и заполнить переменные.
2. Выполнить:

```bash
npm install
npx prisma generate
npx prisma db push --skip-generate
npm run dev
```

3. Проверить базовые URL:
   - `http://localhost:3000/login`
   - `http://localhost:3000/blog`
   - `http://localhost:3000/admin` (для управления постами)

4. Проверить Google:
   - в Google Cloud Console добавить redirect URI:
     - `http://localhost:3000/api/auth/google/callback`
   - в приложении нажать вход через Google на `/login`

5. Проверить Telegram:
   - настроить bot username/token и домен у `@BotFather`
   - проверить вход через Telegram на `/login`

## Деплой-чеклист

1. База/миграции:
   - `npx prisma migrate deploy`
   - убедиться, что существуют таблицы `AuthAccount`, `Post`, `AnalyticsEvent`
2. Env:
   - заполнены `AUTH_JWT_SECRET`, `APP_URL`, Google/Telegram переменные
   - `APP_URL` совпадает с публичным доменом
3. OAuth:
   - Google redirect URI настроен на `${APP_URL}/api/auth/google/callback`
   - Telegram Login Widget domain настроен на ваш домен
4. Smoke-check после деплоя:
   - login email/password
   - login Google
   - login Telegram
   - `/blog` и `/blog/[slug]`
   - `/sitemap.xml` и `/robots.txt`
5. Наблюдаемость:
   - в БД появляются `login_success/login_failed`
   - в БД появляются `blog_post_view/blog_post_share`

## Rollback-план

1. Немедленная стабилизация:
   - отключить проблемный релиз и вернуть предыдущий артефакт/деплой
   - при необходимости временно скрыть соцкнопки входа в UI (feature flag/env)
2. БД:
   - если миграции уже применены, откат делаем только кодом на совместимую схему
   - destructive rollback схемы не выполнять без отдельного бэкапа
3. OAuth:
   - если сбой в внешнем провайдере, оставить активным `email/password` как основной способ входа
4. Проверка после отката:
   - `/login` работает по email/password
   - `/blog` открывается без 500
   - `/admin` и создание/публикация постов доступны администратору
5. Postmortem:
   - зафиксировать причину, добавить тест-кейс, обновить checklist
