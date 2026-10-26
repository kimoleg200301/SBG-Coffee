# Результаты проверки — 26 октября 2026, Asia/Almaty

## Статус локального этапа до загрузки в GitHub

Этот раздел фиксирует завершённую локальную проверку. Последующий статус CI/публикации доступен в [GitHub Actions](https://github.com/kimoleg200301/SBG-Coffee/actions).

**Подготовлено:** монорепозиторий, API, contracts, HTTP/cache mobile, Docker, Compose, workflows, deployment/backup scripts и документация.
**Опубликовано:** нет. GitHub remote/репозиторий не предоставлен, CI в GitHub не запускался, GHCR push не выполнялся.
**Развёрнуто на production:** нет. Сервер, DNS, SSH/GHCR read credentials и Environment не предоставлены. Локальные тестовые контейнеры не являются production deployment.

## Выполнено

| Проверка | Результат |
|---|---|
| Исходные typecheck/lint | PASS |
| Исходные mobile tests | 20/20 PASS |
| Итоговый `npm run check` | PASS: typecheck, lint, все workspace |
| Итоговые unit-тесты | 29 mobile + 5 API + 2 contracts = 36 PASS |
| PostgreSQL integration | 2/2 PASS после итогового lockfile |
| `npm run bootstrap`, `npm run build:api` | PASS |
| Исходное меню против seed | Полное равенство DTO: 6 товаров, 10 вариантов, исходные размеры/цены/image keys |
| Expo/React/RN после установки | 58.0.19 / 19.3.0 / 0.88.0, сохранены |
| `npm ci --dry-run --ignore-scripts` | PASS, корневой lockfile согласован |
| Docker selective `npm ci` build/runtime | PASS, чистое Linux-окружение для API/contracts |
| Expo export web/Android/iOS | PASS в mock и API режимах; итоговые API bundles после всех правок |
| Android запуск | PASS: существующий dev client com.sbgcoffee.app + новый bundle, API; визуально проверены главная и меню |
| Полная Android APK пересборка | Не завершена: ENOSPC в Gradle/C++ native build; это не считается успешной сборкой APK |
| Полная iOS Xcode сборка | Не выполнялась; iOS JS/Hermes bundling PASS |
| Browser/Playwright API online | Реальный каталог и цены, исходные изображения |
| Browser restart без API, с кешем | Товары сохраняются, видны предупреждение и повтор |
| Browser без API и кеша | Ошибка и повтор; mock-товары не появляются |
| Browser восстановление сети | Повтор успешно получает каталог |
| Docker build | PASS, итоговый linux/arm64, USER node |
| Docker smoke | PASS: non-root, нет Expo, migration из этого образа, seed дважды, каталог 6 товаров |
| Замена API-контейнера | Полные Product + ProductVariant строки/цены сохранены |
| Потеря PostgreSQL | /health → 503; API integration также проверяет catalog → 503 без утечки credentials |
| pg_dump / pg_restore | PASS: восстановление в новую тестовую БД, 6 товаров |
| Compose dev/prod, bash -n, ShellCheck | PASS |
| Actionlint 1.7.7 | PASS для обоих итоговых workflows |
| Deployment safety tests (Linux flock) | PASS: чужой package отклонён; migration fail не трогает API; readiness fail не меняет last-success; success сохраняет digest |
| Аудит production API/contracts | 0 уязвимостей |

В mobile дополнительно проверены invalid DTO/URL, timeout/network/HTTP errors, разделение кеша по URL, повреждённый/просроченный кеш, повторная загрузка сохранённого каталога и обновление цен после отказа в создании demo-заказа. Профиль/заказы/лояльность остались demo.

## Изолированная PostgreSQL для воспроизведения

Следующий пример создаёт **новый тестовый контейнер** с tmpfs, не рабочую БД:

```sh
docker run -d --name sbg-coffee-verification-postgres \
  -p 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=sbg -e POSTGRES_PASSWORD=sbg_test_only \
  -e POSTGRES_DB=sbg_test postgres:17.11-bookworm
DATABASE_URL='postgresql://sbg:sbg_test_only@127.0.0.1:55432/sbg_test?connect_timeout=3' npm run test:integration
# После завершения удалить только этот тестовый контейнер:
docker rm -f sbg-coffee-verification-postgres
```

Интеграционный тест сам создаёт случайную схему, применяет миграции, дважды seed и удаляет только свою схему. Требуется доступная пустая тестовая БД с `test` в имени.

## Ограничения и изменения среды

При native Android rebuild закончился диск. Удалены только временные exports/native build outputs проекта и старые регенерируемые Pods/build-кэши, вынесенные при переносе. Архив исходников и manifest SHA256 остались в соседнем `SBG Coffee-pre-monorepo-20261026-123313`. Все исходные файлы учтены; потерь не найдено. Дизайнерские материалы/.pen/PDF/старые exports и screenshot-материалы сохранены.

Docker Desktop перестал отвечать после ENOSPC. После явного разрешения пользователя он перезапущен без удаления образов/volumes других проектов; ранее работавшие `bitrix-mac-dev-db-1`, `bitrix-mac-dev-php-1`, `bitrix-mac-dev-web-1` повторно запущены. Финальные image build/smoke выполнены уже после восстановления Docker.

Проверенный локальный образ имел ID `sha256:e28deb711190f6ca14ad8ba23d5a8bf59c43f583297a44250fae04c93d6e67ca` (linux/arm64). Это ID локальной проверки, **не** опубликованный GHCR digest. Для доставки использовать digest из успешного publish workflow, собранный под фактическую архитектуру сервера. Временные контейнеры, локальные тестовые образы и Expo exports после проверки удалены; исходники Dockerfile/скриптов сохранены.

Полный `npm audit` показывает 5 high findings в сохранённом Expo toolchain: `expo`, `@expo/cli`, `@expo/code-signing-certificates`, `node-forge`, `zod` v3. API/contracts production dependencies имеют 0 findings; уязвимые новые транзитивные зависимости исправлены scoped overrides (multer2.5.0, Swagger js-yaml5.5.0, Prisma deepmerge-ts8.0.2), их совместимость проверена миграциями и контейнером. Автоматический major downgrade Expo не выполнялся: версии Expo/React/RN сохраняются по требованию. Обновление Expo toolchain требует отдельной совместимой миграции.

Требуют внешних настроек: Git/GitHub origin + main; repository Variable API_PLATFORM; Environment production с DEPLOY_HOST, DEPLOY_USER, DEPLOY_PORT, DEPLOY_PATH, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS; Linux-сервер с Docker/Compose/flock; DNS/API_DOMAIN + ACME_EMAIL; серверный production.env с credentials PostgreSQL/CORS и API_IMAGE_REPOSITORY; read:packages login при приватном GHCR. Подробности — docs/deployment.md.
