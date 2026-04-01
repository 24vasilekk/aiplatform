# Changelog: Часть 3 и 4

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
