# Доставка API: Docker → GitHub Actions → GHCR → сервер

Файлы доставки подготовлены для репозитория с основной веткой `main` и существующего сервера `root@b24.hyundaielevator.kz` (`amd64`). Для API предусмотрен адрес `https://sbg-api.hyundaielevator.kz` через уже работающий nginx хоста. API и установленное мобильное приложение выпускаются независимо: изменения `/api/v1` должны сохранять совместимость со старыми версиями приложения.

Состояние при подготовке 2026-10-26: DNS A домена API указывает на `89.46.33.196`, AAAA отсутствует. Первичная CI-публикация в GHCR проверена; образ доступен для анонимного pull. GitHub Environment `production` создан и ограничен `main`, его переменные и `DEPLOY_KNOWN_HOSTS` заданы; `DEPLOY_SSH_KEY` ещё не настроен. На сервере отсутствуют `/opt/sbg-coffee` и сертификат домена API. Проверка сервера выполнялась только на чтение: эти файлы и инструкции не означают, что API уже доставлен или nginx изменён.

## Образ и проверка локально

Из корня монорепозитория:

```sh
npm run docker:build
bash infra/scripts/check-config.sh
bash infra/scripts/test-deploy.sh
bash infra/scripts/test-compose-network.sh sbg-coffee-api:local
bash infra/scripts/test-nginx.sh
bash infra/scripts/container-smoke.sh sbg-coffee-api:local
```

Dockerfile использует корневой lockfile и устанавливает только workspaces API/contracts. Contracts собирается первым; Expo, assets, Pods, `.env` и нативные сборки не входят в контекст. Runtime содержит production-зависимости, скомпилированный API, Prisma Client, CLI и схему/миграции того же релиза. Процесс работает как `node`, не root. Команда миграции из этого образа: `npm run db:migrate --workspace @sbg/api`.

Smoke-проверка создаёт отдельную сеть и PostgreSQL с `tmpfs`, запускает миграцию, два seed в `NODE_ENV=test`, HTTP-каталог, заменяет API-контейнер и сравнивает данные. Затем проверяет, что потеря БД делает `/health` неготовым. Удаляются только контейнеры и сеть этой проверки. Production seed не запускается автоматически.

`test-deploy.sh` использует mock Docker и настоящий `flock`, поэтому на macOS без `flock` выполняется в Linux. `test-compose-network.sh` проверяет доступность опубликованного loopback-порта при сетях production Compose на изолированных контейнерах. `test-nginx.sh` требует Docker, curl, OpenSSL и Node: проверяет реальные шаблоны на nginx `1.24.0`, HTTP bootstrap без сертификата, ACME без redirect, HTTPS, `/health`, сохранение `/api/v1`, query и proxy headers. Для него создаются временный сертификат, случайные loopback-порты и собственные контейнеры; ACME и рабочий сервер не затрагиваются.

## GitHub и публикация

1. Репозиторий проекта: [kimoleg200301/SBG-Coffee](https://github.com/kimoleg200301/SBG-Coffee), основная ветка `main`. Локальный `origin` направлен на этот репозиторий. Исходный каталог до переноса не имел Git-истории.
2. Включить GitHub Actions, разрешить workflow публикацию GitHub Packages. Для существующего GHCR-пакета предоставить этому репозиторию Actions access. Защитить `main` обязательными CI-проверками и review.
3. Архитектура сервера подтверждена владельцем: `amd64`. Repository Variable `API_PLATFORM=linux/amd64`. Workflow собирает образ на нативном amd64 runner. При будущем переходе на ARM64 потребуется настроить соответствующий runner или QEMU и повторить проверки.
4. Push в `main` запускает `.github/workflows/ci.yml`: typecheck/lint/tests, сборку API/contracts, интеграционный тест с отдельной PostgreSQL, Expo exports Android/iOS/web, проверку Compose/workflow и сборку/проверку Docker-образа.
5. Только после успешных `checks` и `docker` job `publish` получает `packages: write`. Он публикует `ghcr.io/kimoleg200301/sbg-coffee-api:sha-<commit>` с `GITHUB_TOKEN`. PR не получает production Environment или production-секреты, не публикует образ.
6. Скопировать полный `ghcr.io/...-api@sha256:...` из workflow summary или artifact `api-image-<commit>/api-image.txt`. Тег удобен для поиска; в production применяется digest.

PostgreSQL закреплён на `postgres:17.11-bookworm`; обновления patch-версии выполнять отдельной проверенной операцией. Dockerfile использует линию Node 22. Перед обновлением зависимостей/образов повторять контейнерные проверки. nginx и сертификаты принадлежат существующей инфраструктуре хоста и не входят в Docker Compose приложения.

## Подготовка Linux-сервера

На проверенном хосте: CentOS 7, x86_64, Docker `26.1.4`, Compose `2.27.1`, nginx `1.24.0`; TCP 80/443 заняты существующими сайтами, TCP 3100 свободен, SELinux отключён. Используются уже установленные Docker/Compose и nginx. Не устанавливать второй reverse proxy, не заменять общий nginx.conf и не менять существующие сайты, контейнеры или БД в ходе доставки SBG Coffee.

Скриптам нужны Docker Engine и Compose plugin с поддержкой `up --wait`, Bash, `flock` (util-linux), `curl`, `tar`, `sed`, `nohup`. Пользователь deployment — `root`; его ключ имеет административные возможности и должен использоваться только для согласованной доставки.

Администратор отдельно создаёт `/opt/sbg-coffee`, копирует [infra/.env.example](../infra/.env.example) в **серверный** `/opt/sbg-coffee/production.env`, устанавливает права `600` и заменяет значения. Путь для workflow — абсолютный, без пробелов, только буквы/цифры/`/`/`_`/`-`.

| Настройка сервера | Смысл |
| --- | --- |
| `API_IMAGE_REPOSITORY` | `ghcr.io/kimoleg200301/sbg-coffee-api`, без кавычек, тега и digest |
| `POSTGRES_USER`, `POSTGRES_DB` | Начальный пользователь и база PostgreSQL |
| `POSTGRES_PASSWORD` | Случайный пароль, отсутствующий в Git |
| `DATABASE_URL` | PostgreSQL URL с host `postgres`; пароль URL-encoded |
| `CORS_ORIGINS` | Разрешённые web origins через запятую; пусто — cross-origin web не разрешён |

Не добавлять `API_IMAGE`: deployment передаёт проверенный digest через окружение. В `production.env` используется формат dotenv/Compose; значения с `$` заключать в одинарные кавычки по правилам Compose. `API_IMAGE_REPOSITORY` должен оставаться простым значением без кавычек.

Compose публикует только API: `127.0.0.1:3100:3000`. API подключён к внутренней сети `backend` и обычной сети `edge`, чтобы публикация порта работала; PostgreSQL и контейнер миграций подключены только к `backend`. У PostgreSQL нет host-порта, имя volume остаётся `sbg-coffee-production-postgres`. nginx хоста проксирует в `http://127.0.0.1:3100`; порты 80/443 приложение не занимает.

На Docker **до 28.0.0** localhost-published порты могут быть доступны соседям того же L2-сегмента. На этом хосте Docker `26.1.4`, поэтому bind на `127.0.0.1` сам по себе **не доказывает внешнюю изоляцию**. Перед вводом API в эксплуатацию отдельно проверить сетевые ограничения хоста/провайдера либо запланировать совместимое обновление Docker. Эта адаптация не обновляет Docker и не меняет firewall. Ограничение описано в [документации Docker о публикации портов](https://docs.docker.com/engine/network/port-publishing/).

DNS A должен оставаться направлен на `89.46.33.196`; не добавлять AAAA, пока IPv6 для этого vhost не настроен и не проверен. Для ACME/GHCR нужен исходящий HTTPS, а для HTTP-01 — доступ к существующему TCP 80. Домен и ACME управляются nginx/dehydrated хоста; `API_DOMAIN` и `ACME_EMAIL` в env приложения не требуются.

Для текущего публичного пакета login не нужен. Если GHCR станет **приватным**, один раз войти на сервере от deployment-пользователя с отдельным токеном с `read:packages` и доступом только к нужному пакету (при SSO авторизовать токен). У токена не должно быть `write:packages`/`delete:packages`. Пароль вводить через `--password-stdin`, не сохранять в командной строке/истории:

```sh
read -r -s GHCR_READ_TOKEN
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io --username YOUR_READ_ONLY_ACCOUNT --password-stdin
unset GHCR_READ_TOKEN
```

Использовать Docker credential helper либо ограничить доступ к `~/.docker/config.json`. Publisher `GITHUB_TOKEN` на сервер не передаётся.

## Подготовка nginx и сертификата

Это отдельная ручная подготовка хоста; обычный deployment её не выполняет. Хост загружает `/etc/nginx/bx/site_ext_enabled/*.conf`, а не стандартный `conf.d`. Шаблоны [sbg-api.http.conf](../infra/nginx/sbg-api.http.conf) и [sbg-api.https.conf](../infra/nginx/sbg-api.https.conf) добавляют только vhost `sbg-api.hyundaielevator.kz`, без `default_server`. Не заменять существующие файлы других сайтов.

1. После создания `/opt/sbg-coffee` скопировать туда оба проверенных шаблона из репозитория. Убедиться, что новые имена в `site_ext_enabled` ещё не заняты. Установить **только HTTP**:

   ```sh
   install -m 0644 /opt/sbg-coffee/sbg-api.http.conf /etc/nginx/bx/site_ext_enabled/sbg-api.http.conf
   nginx -t && systemctl reload nginx
   ```

   HTTP использует существующий `/etc/nginx/bx/conf/letsencrypt-challenge-tokens.conf`, где `/.well-known/acme-challenge` обслуживается через `alias /var/www/dehydrated`. Остальные пути перенаправляются на HTTPS. Redirect находится внутри `location /`, поэтому ACME challenge получает файл, а не redirect. До выпуска сертификата HTTPS ещё недоступен; это ожидаемо. Проверить HTTP-01 извне, используя временный token-файл в `/var/www/dehydrated`, и удалить только этот файл после проверки.

2. Зарегистрировать `sbg-api.hyundaielevator.kz` отдельной строкой в `/home/bitrix/dehydrated/domains.txt`, сохранив существующие записи и владельца `bitrix`. Это сохраняет домен для дальнейшего renewal. Выпустить **только его** сертификат существующим dehydrated от пользователя `bitrix`:

   ```sh
   su -s /bin/bash bitrix -c '/home/bitrix/dehydrated/dehydrated --cron --domain sbg-api.hyundaielevator.kz --config /home/bitrix/dehydrated/config'
   ```

   Проверить успешный выпуск и наличие `fullchain.pem`, `privkey.pem`, `chain.pem` в `/home/bitrix/dehydrated/certs/sbg-api.hyundaielevator.kz/`. Проверить, что существующее расписание dehydrated обрабатывает `domains.txt`, а его renewal hook перезагружает nginx после обновления сертификатов. Не создавать параллельный ACME-клиент и не запускать выпуск для всех чужих доменов.

3. Только после появления сертификата установить **HTTPS**, сохранив HTTP для renewal:

   ```sh
   install -m 0644 /opt/sbg-coffee/sbg-api.https.conf /etc/nginx/bx/site_ext_enabled/sbg-api.https.conf
   nginx -t && systemctl reload nginx
   ```

   HTTPS использует сертификат этого домена и существующий `/etc/nginx/bx/conf/ssl_options.conf`. `proxy_pass http://127.0.0.1:3100` указан без URI-суффикса: nginx сохраняет `/api/v1` и query. Явно установлен HTTP/1.1 и передаются Host, схема и адрес клиента. Если `nginx -t` не проходит, не перезагружать nginx; исправить или убрать только добавленный файл SBG Coffee. Проверка локального шаблона не заменяет `nginx -t` с полным конфигом реального хоста.

После запуска API проверить на сервере `curl --fail http://127.0.0.1:3100/health`, затем **с другой машины**:

```sh
curl --fail --show-error https://sbg-api.hyundaielevator.kz/health
curl --fail --show-error https://sbg-api.hyundaielevator.kz/api/v1/catalog/products
```

Не использовать `-k`: внешний тест должен подтвердить DNS, сертификат и маршрут через nginx. До запуска API HTTPS может отвечать 502, даже когда сертификат и vhost корректны. Loopback-readiness deployment не подтверждает внешний HTTPS.

## GitHub Environment production

Environment `production` создан и ограничен веткой `main`; при желании включить required reviewers. Проверить значения и добавить недостающий SSH-ключ:

| Тип | Имя | Значение |
| --- | --- | --- |
| Repository Variable | `API_PLATFORM` | `linux/amd64` |
| Environment Variable | `DEPLOY_HOST` | `b24.hyundaielevator.kz` |
| Environment Variable | `DEPLOY_USER` | `root` |
| Environment Variable | `DEPLOY_PORT` | `22` |
| Environment Variable | `DEPLOY_PATH` | `/opt/sbg-coffee` |
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
4. Только после успешных миграций заменяет API, ждёт контейнерный `/health`, затем через `curl` проверяет `http://127.0.0.1:3100/health` на хосте.
5. Записывает digest в `state/current-image`, предыдущий успешный — в `state/previous-image`, результат — в `state/history.tsv` и `jobs/<run-id>.status`.

Deployment не устанавливает, не редактирует и не перезагружает nginx, не выпускает сертификаты и не управляет чужими сервисами. GitHub `concurrency` имеет `cancel-in-progress: false`; серверный lock также исключает одновременную доставку из другого запуска/терминала. Если workflow отменён или его наблюдатель потерял SSH/достиг таймаута, серверный процесс продолжает миграцию и удерживает lock. Перед повтором прочитать `jobs/<run-id>.log` и `.status`. Ошибка миграции оставляет предыдущий API-контейнер; ошибка контейнерной или loopback-readiness после переключения требует ручного решения и не обновляет запись последнего успеха. Log/step summary не является заменой проверки внешнего HTTPS.

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
- [nginx: proxy_pass и передача заголовков](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
- [Docker: публикация портов и ограничения localhost до версии 28](https://docs.docker.com/engine/network/port-publishing/).
