# Доставка API: Docker → GitHub Actions → GHCR → сервер

Все файлы подготовлены для репозитория с основной веткой `main`. Локальная подготовка файлов сама по себе не публикует образ и не обновляет сервер. API и установленное мобильное приложение выпускаются независимо: изменения `/api/v1` должны сохранять совместимость со старыми версиями приложения.

## Образ и проверка локально

Из корня монорепозитория:

```sh
npm run docker:build
bash infra/scripts/check-config.sh
bash infra/scripts/container-smoke.sh sbg-coffee-api:local
```

Dockerfile использует корневой lockfile и устанавливает только workspaces API/contracts. Contracts собирается первым; Expo, assets, Pods, `.env` и нативные сборки не входят в контекст. Runtime содержит production-зависимости, скомпилированный API, Prisma Client, CLI и схему/миграции того же релиза. Процесс работает как `node`, не root. Команда миграции из этого образа: `npm run db:migrate --workspace @sbg/api`.

Smoke-проверка создаёт отдельную сеть и PostgreSQL с `tmpfs`, запускает миграцию, два seed в `NODE_ENV=test`, HTTP-каталог, заменяет API-контейнер и сравнивает данные. Затем проверяет, что потеря БД делает `/health` неготовым. Удаляются только контейнеры и сеть этой проверки. Production seed не запускается автоматически.

## GitHub и публикация

1. Репозиторий проекта: [kimoleg200301/SBG-Coffee](https://github.com/kimoleg200301/SBG-Coffee), основная ветка `main`. Локальный `origin` направлен на этот репозиторий. Исходный каталог до переноса не имел Git-истории.
2. Включить GitHub Actions, разрешить workflow публикацию GitHub Packages. Для существующего GHCR-пакета предоставить этому репозиторию Actions access. Защитить `main` обязательными CI-проверками и review.
3. Архитектура сервера подтверждена владельцем: `amd64`. Repository Variable `API_PLATFORM=linux/amd64`. Workflow собирает образ на нативном amd64 runner. При будущем переходе на ARM64 потребуется настроить соответствующий runner или QEMU и повторить проверки.
4. Push в `main` запускает `.github/workflows/ci.yml`: typecheck/lint/tests, сборку API/contracts, интеграционный тест с отдельной PostgreSQL, Expo exports Android/iOS/web, проверку Compose/workflow и сборку/проверку Docker-образа.
5. Только после успешных `checks` и `docker` job `publish` получает `packages: write`. Он публикует `ghcr.io/<owner>/<repository>-api:sha-<commit>` с `GITHUB_TOKEN`. PR не получает production Environment или production-секреты, не публикует образ.
6. Скопировать полный `ghcr.io/...-api@sha256:...` из workflow summary или artifact `api-image-<commit>/api-image.txt`. Тег удобен для поиска; в production применяется digest.

Базовые контейнеры закреплены на `postgres:17.11-bookworm` и `caddy:2.10.2-alpine`. PostgreSQL 17 — поддерживаемая ветка; обновления patch-версии выполнять отдельной проверенной операцией. Dockerfile использует поддерживаемую линию Node 22. Перед обновлением зависимостей/образов повторять контейнерные проверки.

## Подготовка Linux-сервера

Нужны Docker Engine и Compose plugin с поддержкой `up --wait`, Bash, `flock` (util-linux), `tar`, `sed`, `nohup`. Пользователь deployment должен иметь доступ к Docker и право записи в выделенный каталог; доступ к Docker фактически даёт административные возможности на хосте, поэтому ключ должен принадлежать только deployment.

Создать каталог, например `/opt/sbg-coffee`, принадлежащий deployment-пользователю. Путь для workflow — абсолютный, без пробелов, только буквы/цифры/`/`/`_`/`-`. Скопировать `infra/.env.example` в **серверный** `/opt/sbg-coffee/production.env`, установить права `600`, заменить значения:

| Настройка сервера | Смысл |
| --- | --- |
| `API_IMAGE_REPOSITORY` | Точный lowercase `ghcr.io/owner/repository-api`, без кавычек, тега и digest |
| `API_DOMAIN` | DNS-имя API, например `api.example.com` |
| `ACME_EMAIL` | Адрес администратора сертификатов |
| `POSTGRES_USER`, `POSTGRES_DB` | Начальный пользователь и база PostgreSQL |
| `POSTGRES_PASSWORD` | Случайный пароль, отсутствующий в Git |
| `DATABASE_URL` | PostgreSQL URL с host `postgres`; пароль URL-encoded |
| `CORS_ORIGINS` | Разрешённые web origins через запятую; пусто — cross-origin web не разрешён |

Не добавлять `API_IMAGE`: deployment передаёт проверенный digest через окружение. В `production.env` используется формат dotenv/Compose; значения с `$` заключать в одинарные кавычки по правилам Compose. `API_IMAGE_REPOSITORY` должен оставаться простым значением без кавычек.

Настроить DNS A/AAAA на сервер, открыть TCP 80/443 (и при необходимости UDP443), обеспечить исходящий HTTPS для ACME/GHCR. SSH ограничить подходящими сетевыми правилами. PostgreSQL и API не имеют опубликованных портов; Caddy связывается с API во внутренней сети. Caddy получает и обновляет сертификат при корректном DNS и доступности портов. Наличие здорового Caddy-контейнера ещё не проверяет внешний DNS/TLS: после первой доставки проверить `curl --fail https://<домен>/health` с другой машины.

Для **приватного** GHCR один раз войти на сервере от deployment-пользователя с отдельным токеном с `read:packages` и доступом только к нужному пакету (при SSO авторизовать токен). У токена не должно быть `write:packages`/`delete:packages`. Пароль вводить через `--password-stdin`, не сохранять в командной строке/истории:

```sh
read -r -s GHCR_READ_TOKEN
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io --username YOUR_READ_ONLY_ACCOUNT --password-stdin
unset GHCR_READ_TOKEN
```

Использовать Docker credential helper либо ограничить доступ к `~/.docker/config.json`. Publisher `GITHUB_TOKEN` на сервер не передаётся. Для публичного пакета серверный login не нужен.

## GitHub Environment production

Создать Environment `production`, ограничить deployment веткой `main`; при желании включить required reviewers. Сохранить:

| Тип | Имя | Значение |
| --- | --- | --- |
| Repository Variable | `API_PLATFORM` | `linux/amd64` или `linux/arm64` |
| Environment Variable | `DEPLOY_HOST` | DNS-имя или IPv4 сервера |
| Environment Variable | `DEPLOY_USER` | SSH-пользователь deployment |
| Environment Variable | `DEPLOY_PORT` | SSH-порт; по умолчанию `22` |
| Environment Variable | `DEPLOY_PATH` | Например `/opt/sbg-coffee` |
| Environment Secret | `DEPLOY_SSH_KEY` | Закрытый SSH-ключ пользователя deployment |
| Environment Secret | `DEPLOY_KNOWN_HOSTS` | Проверенная строка(и) OpenSSH known_hosts |

Host key получить и сверить **независимым доверенным каналом**: например через консоль провайдера `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. Для нестандартного порта запись known_hosts использует `[host]:port`. Workflow не доверяет результату `ssh-keyscan` без проверки и всегда использует `StrictHostKeyChecking=yes`.

Серверные `DATABASE_URL`, пароль БД, токен чтения GHCR остаются на сервере. Ни один из них не относится к `EXPO_PUBLIC_*` и не нужен в PR jobs. Отдельный publishing PAT не требуется.

## Ручной deployment

В Actions открыть **Deploy API to production**, выбрать ветку `main`, Run workflow, вставить полный digest image из успешной публикации. Workflow сверяет пакет с `ghcr.io/${repository}-api`, а сервер повторно сверяет его с `API_IMAGE_REPOSITORY`.

Workflow переносит только `infra` в отдельный release-каталог и запускает самостоятельный `nohup`-процесс на сервере. Скрипт:

1. Берёт `flock` для всего deployment, получает образ по digest.
2. Поднимает PostgreSQL при первом запуске или сохраняет существующий контейнер через `--no-recreate`, ждёт readiness.
3. Один раз вызывает `prisma migrate deploy` из **выбранного образа**. Повторная доставка безопасно проверяет уже применённые миграции.
4. Только после успешных миграций заменяет API, ждёт `/health`, затем запускает/обновляет Caddy.
5. Записывает digest в `state/current-image`, предыдущий успешный — в `state/previous-image`, результат — в `state/history.tsv` и `jobs/<run-id>.status`.

GitHub `concurrency` имеет `cancel-in-progress: false`; серверный lock также исключает одновременную доставку из другого запуска/терминала. Если workflow отменён или его наблюдатель потерял SSH/достиг таймаута, серверный процесс продолжает миграцию и удерживает lock. Перед повтором прочитать `jobs/<run-id>.log` и `.status`. Ошибка миграции оставляет предыдущий API-контейнер; ошибка readiness после переключения требует ручного решения. Log/step summary не является заменой проверки внешнего HTTPS.

Один API-контейнер может дать кратковременный простой при замене; обновление без простоя здесь не обещается. `state/current-image` означает **последний успешный** deployment; при неудачном переключении фактически запущенный контейнер может иметь другой digest — проверить `docker inspect` и history.

## Миграции и откат

Миграция выполняется, пока работает предыдущая версия API. Использовать expand/contract: сначала добавлять совместимые nullable/default поля и новые таблицы; перенос данных и удаление старых полей выполнять отдельными последующими релизами после вывода старых клиентов/серверов. Проверять миграции на копии данных и создавать backup перед значимыми изменениями.

Для отката контейнера запустить тот же manual workflow с digest из `state/previous-image` (или `state/current-image`, если новая доставка не прошла readiness). Предварительно проверить совместимость старого API с уже изменённой схемой. Prisma этого образа выполнит проверку миграций; нельзя считать это откатом схемы. При несовместимой схеме нужен отдельный forward fix или согласованное восстановление из backup. Автоматического rollback БД нет.

В production не применяются `migrate reset`, `db push`, удаление volumes или demo-seed. PostgreSQL volume имеет постоянное имя `sbg-coffee-production-postgres`; обновление API его не пересоздаёт. Изменение пароля в env само по себе не меняет пароль уже существующей PostgreSQL — ротация требует отдельного `ALTER ROLE` и согласованного обновления конфигурации.

После первой production-миграции каталог пуст. Наполнение реального меню требует отдельно согласованного импорта проверенных товаров/цен; административный интерфейс в этот этап не входит. Demo-seed текущего мобильного меню предназначен для локальной и тестовой БД и отказывается работать при `NODE_ENV=production`.

## Резервное копирование и восстановление

Именованный volume защищает данные от замены контейнера, **но не является резервной копией**.

```sh
bash /opt/sbg-coffee/releases/RELEASE/infra/scripts/backup.sh /opt/sbg-coffee /secure-backups
```

Команда создаёт согласованный custom-format `pg_dump` с правами `600`. Переносить backup в независимое зашифрованное хранилище с политикой retention; регулярно проверять восстановление. Сохранять также нужные роли/права, серверную конфигурацию и запись digest отдельным защищённым способом. Для требования малого RPO понадобится WAL/PITR, а не только ежедневный dump.

Проверка восстановления выполняется в **новой пустой БД**, не поверх рабочей. Например на отдельном тестовом PostgreSQL17, задав `PGHOST`, `PGPORT`, `PGUSER` и `PGPASSFILE` с правами600:

```sh
createdb sbg_restore_check
pg_restore --exit-on-error --no-owner --no-acl --dbname=sbg_restore_check /secure-backups/sbg-TIMESTAMP.dump
psql --dbname=sbg_restore_check --command='SELECT count(*) FROM "Product";'
```

При аварии остановить запись, определить последнюю пригодную копию и потерю данных, восстановить в новую БД/новый volume, проверить миграции и каталог тестовым API, затем изменить `DATABASE_URL` и доставить совместимый digest. Исходную БД/volume сохранять для расследования. Не запускать разрушительное восстановление поверх production автоматически.

## Источники решений

- [Expo: штатная поддержка npm workspaces/monorepo](https://docs.expo.dev/guides/monorepos/).
- [GitHub: публикация Docker-образов и GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
- [PostgreSQL: сроки поддержки версий](https://www.postgresql.org/support/versioning/).
- [Caddy: требования автоматического HTTPS](https://caddyserver.com/docs/automatic-https).
