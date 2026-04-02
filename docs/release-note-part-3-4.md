# Release Note: Часть 3 и 4

Дата релиза: 2026-04-01

## Объем релиза

Часть 3 и 4 завершены в production-ориентированном объеме:

- платежи и доступы к курсам
- прогресс ученика и API прогресса
- админ-аналитика покупок и продуктовые метрики
- observability и error monitoring
- security hardening
- масштабирование через очередь и read/write separation
- набор автотестов для критичного контура

## Ключевые изменения

1. Платежный контур
- `create checkout` с primary/fallback provider
- webhook с подписью `x-billing-signature`
- идемпотентность и статусы (`created`, `processing`, `succeeded`, `failed`, `canceled`)
- выдача доступа к курсам после успешной оплаты
- обработка `failed/canceled`

2. Баланс-кошелек
- пополнение баланса и списание при покупке
- журнал транзакций
- защита от двойного списания через idempotency key

3. Прогресс и аналитика
- прогресс на уровне курса/урока/задания
- API для кабинета и админки
- аналитика покупок с фильтрами/сортировкой/CSV
- DAU/WAU, регистрация, конверсия в оплату, retention (min), AI-активность
- дашборд «Финансы и продукт» в админке

4. Надежность и эксплуатация
- structured logs + request/correlation id
- health/readiness endpoints
- мониторинг ошибок в админке
- admin audit log по mutation-действиям

5. Масштабирование
- отделение read/write операций (`ReadOps`, `WriteOps`)
- очередь `JobQueue` для тяжелых задач
- async processing для dataset-файлов
- retry/backoff с jitter для job-обработчика

6. Тесты
- покрытие критичных API и ключевых UI-сценариев
- стабильный `npm test`

## Технические акценты

- тяжелый процессинг датасетов вынесен из request-path в очередь
- админские списки переведены на пагинацию
- безопасные GET endpoint-ы получили cache policy
- админ-панель оптимизирована через lazy-loading блоков

## Известные ограничения

- выполнение очереди задач пока запускается через ops endpoint (нужен cron/worker)
- для кластерного прод-нагрузки rate-limit store стоит вынести в Redis/Upstash

## Ссылки

- Runbook: [runbook-part-3-4.md](./runbook-part-3-4.md)
- Changelog: [changelog-part-3-4.md](./changelog-part-3-4.md)
- Roadmap: [roadmap-next-stage.md](./roadmap-next-stage.md)

---

## Stabilization Update (2026-04-02)

После основного релиза выполнен финальный стабилизационный проход:

- env readiness gate (`npm run env:check`) + расширенный `/api/readiness`
- schema/version readiness-check и maintenance mode для несовместимой схемы
- CI release-check pipeline (`migrate status`, `schema:check`, `lint/test/build`, smoke)
- метрики readiness в `/api/metrics` (`service_schema_readiness`, `service_env_readiness`)
- runbook обновлен командами backup/restore/rollback
- закрытие критичных типизационных и lint-блокеров
- закрыт P0: Edge middleware больше не импортирует Node-only зависимости через `auth/db`
- обновление runbook/README/changelog под эксплуатационный контур релиза
- release gate подтвержден: без `prisma migrate deploy` сервис остается в `maintenance` по `schema_behind_code`
