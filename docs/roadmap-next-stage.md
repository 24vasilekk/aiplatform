# Roadmap: Следующий этап (Часть 5)

## Цели этапа

1. Вывести проект из MVP в managed-production режим.
2. Уменьшить ручные операции (очереди/ops) и повысить надежность.
3. Дорастить архитектуру до multi-instance нагрузки.

## Приоритет P0 (обязательное)

1. Выделенный worker-процесс для `JobQueue`
- отдельный runtime, который постоянно вычитывает pending jobs
- graceful shutdown и lock/heartbeat
- метрики очереди: lag, throughput, fail-rate

2. Redis/Upstash для rate limits и коротких кэшей
- убрать in-memory state из API-инстансов
- единый shared store для multi-node

3. Sentry/Alertmanager интеграция
- алерты по критичным ошибкам и деградации платежей
- алерты по backlog очереди

4. Полноценный CI gate
- lint + test + build + smoke API checks
- публикация coverage report

## Приоритет P1 (важное)

1. Read replica / CQRS-light
- read-heavy endpoints направлять на read replica
- write path оставить на primary

2. API versioning и контрактные тесты
- `v1` namespace для публичных API
- schematized response contracts

3. Background jobs catalog
- нормализовать job types
- добавить dead-letter strategy

4. Безопасность
- WAF rules для auth/payment/webhook
- ротация секретов и автоматизация webhook key lifecycle

## Приоритет P2 (рост продукта)

1. Расширенная learning analytics
- cohort/segment drill-down
- attribution по acquisition channels

2. Billing enhancements
- refunds/chargeback workflows
- reconciliation jobs

3. Performance budget
- RUM + Core Web Vitals бюджет
- автоматические регресс-тесты по latency

## Критерии готовности этапа

- очередь выполняется автоматически без ручного `run_pending`
- p95 latency по критичным API в целевом бюджете
- алерты покрывают платежи, очередь, readiness, error spikes
- откат релиза и восстановление отработаны по runbook без ad-hoc действий
