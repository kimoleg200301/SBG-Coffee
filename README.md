# SBG Coffee

[![CI and publish API](https://github.com/kimoleg200301/SBG-Coffee/actions/workflows/ci.yml/badge.svg)](https://github.com/kimoleg200301/SBG-Coffee/actions/workflows/ci.yml)

npm-монорепозиторий: Expo-приложение, NestJS API каталога и общие контракты.
Каталог API читает PostgreSQL. Корзина, избранное и профиль сохраняются локально; заказы и лояльность остаются демонстрационными.

- `apps/mobile` — существующее приложение Expo 58 / React 19.3 / React Native 0.88.
- `apps/api` — NestJS, Prisma, миграции и seed.
- `packages/contracts` — DTO и Zod-схемы без зависимостей от платформы.
- `infra` — PostgreSQL, production Compose, HTTPS и скрипты доставки.
- `.github/workflows` — CI, GHCR и ручной production deployment.

## Быстрый запуск

Нужны Node 22 (не ниже 22.14), npm 10+, Docker Compose v2.

```sh
npm ci
npm run bootstrap
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
npm run db:up
npm run db:migrate
npm run db:seed
npm run api
```

В другом терминале:

```sh
npm run mobile
# либо npm run android / npm run ios / npm run web
```

По умолчанию mobile работает в mock-режиме без backend. Для API задайте в `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_CATALOG_SOURCE=api
EXPO_PUBLIC_API_URL=http://localhost:3000
```

После изменения переменных перезапустите Expo. URL для устройства отличается: см. [локальный запуск](docs/local-development.md).

```sh
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/catalog/products
npm run check
npm run build:api
npm run docker:build
```

OpenAPI: `http://localhost:3000/docs`, JSON: `http://localhost:3000/docs-json`.

## Документация

- [Архитектура и будущие серверные границы](docs/architecture.md)
- [Локальный запуск и подключение устройств](docs/local-development.md)
- [Сервер, GitHub, GHCR, доставка и резервные копии](docs/deployment.md)
- [Исходные проверки и архив для восстановления](docs/baseline.md)
- [Результаты проверок](docs/verification.md)

Backend и mobile выпускаются независимо. API v1 должен оставаться совместимым с уже установленными версиями приложения. Развёртывание backend не обновляет приложение на телефоне.
