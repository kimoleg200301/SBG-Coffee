# Локальный запуск

Все команды ниже выполняются из корня репозитория, кроме явно указанного пути. Используйте один корневой package-lock.json и `npm ci`; зависимости объявлены в использующих их workspace.

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

API слушает `0.0.0.0:3000`, PostgreSQL для разработки публикуется только на loopback. Точный порт и реквизиты приведены в `infra/compose.dev.yaml` и примере env API. Переменные среды процесса имеют приоритет над файлом apps/api/.env. Не используйте dev-пароли на сервере.

Отдельный терминал: `npm run mobile`. `npm run android`, `npm run ios`, `npm run web` сохраняют привычные команды. Можно также запускать `npm run start -w @sbg/mobile` и `npm run dev -w @sbg/api` независимо. Перед API соберите contracts и сгенерируйте Prisma (`npm run bootstrap`).

## Подключение mobile

В `apps/mobile/.env` укажите `EXPO_PUBLIC_CATALOG_SOURCE=api` и подходящий `EXPO_PUBLIC_API_URL` без `/api/v1`:

| Среда | URL | Подготовка |
|---|---|---|
| Web / iOS Simulator | `http://localhost:3000` | Разрешите origin web в CORS_ORIGINS API |
| Android Emulator | `http://10.0.2.2:3000` | API запущен на компьютере |
| Android по USB | `http://localhost:3000` | `adb reverse tcp:3000 tcp:3000` |
| Телефон по Wi-Fi | `http://<LAN-IP-компьютера>:3000` | Одна сеть, firewall разрешает порт 3000 |
| Production | `https://sbg-api.hyundaielevator.kz` | DNS + nginx хоста + валидный TLS; [подготовка](deployment.md) |

Для dev-сборок используется локальный HTTP; production должен использовать HTTPS. На iOS доступ к LAN может требовать разрешения локальной сети. Android debug допускает cleartext через собственный debug manifest; release не следует ослаблять ради локальной разработки. CORS относится к web: добавьте точный origin Expo web (обычно `http://localhost:8081`) в `CORS_ORIGINS`, разделив несколько origin запятой. CORS не является авторизацией.

Перезапустите Expo после изменения `.env`; переменные EXPO_PUBLIC встраиваются в bundle. `EXPO_PUBLIC_CATALOG_SOURCE=mock` работает без API и БД. Ошибка API-режима сохраняет выбранный источник, показывает ошибку/повтор и при наличии кеша — сохранённый каталог с предупреждением о ценах.

## Команды

| Команда | Действие |
|---|---|
| `npm run check` | TypeScript, lint, unit-тесты всех workspace |
| `npm run build:api` | Сборка contracts и API |
| `npm run db:up` / `npm run db:stop` | Запуск / остановка dev PostgreSQL без удаления данных |
| `npm run db:migrate` | Применение версионированных миграций |
| `npm run db:status` | Состояние миграций |
| `npm run db:seed` | Сборка и повторяемый seed для разработки |
| `npm run test:integration` | Интеграционный тест на отдельной тестовой БД (см. ниже) |
| `npm run export:web` / `npm run export:native` | Expo bundling |
| `npm run docker:build` | Docker image `sbg-coffee-api:local`, context — корень |

Интеграционные тесты используют `DATABASE_URL` отдельной тестовой БД, имя которой обязательно содержит `test` (например `sbg_test`). Не направляйте их на рабочую БД. CI создаёт отдельный service PostgreSQL. Нужна только пустая тестовая БД: тест сам создаёт случайную схему, применяет миграции и seed дважды, затем удаляет только свою схему. Конкретные локальные команды записаны в docs/verification.md.

## Нативные проекты

`apps/mobile/ios` и `apps/mobile/android` сохраняют существующие нативные исходники. `prebuild --clean` не выполнялся. Pods и build-кэши не являются переносимым окружением; CocoaPods и Gradle должны подготовить зависимости заново. Ссылки пакетов используют разрешение Node и штатную поддержку monorepo в Expo. Ручных Metro watchFolders/resolver обходов нет.

Для Android нужны установленный Android SDK, JAVA_HOME совместимого JDK и доступный эмулятор/устройство. Для iOS — Xcode и CocoaPods; `npm run ios` запускает штатный Expo процесс подготовки и сборки. EAS запускайте из `apps/mobile`, где находится eas.json. Идентификаторы приложения, scheme и версии Expo/React/React Native сохранены.

Штатная конфигурация monorepo описана в [документации Expo](https://docs.expo.dev/guides/monorepos/).
