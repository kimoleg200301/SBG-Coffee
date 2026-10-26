#!/usr/bin/env bash
# Exercise rollout safety without running Docker or touching any real deployment.
set -Eeuo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d /tmp/sbg-deploy-test-XXXXXXXX)
trap 'rm -rf "$test_dir"' EXIT
mkdir -p "$test_dir/bin" "$test_dir/server/state"
cat > "$test_dir/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$MOCK_LOG"
case " $* " in
  *' run --rm --no-deps migrate '*) exit "${MOCK_MIGRATION_EXIT:-0}" ;;
  *' up -d --no-deps --wait --wait-timeout 120 api '*) exit "${MOCK_READINESS_EXIT:-0}" ;;
esac
MOCK
chmod +x "$test_dir/bin/docker"
cat > "$test_dir/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'curl %s\n' "$*" >> "$MOCK_LOG"
[[ " $* " == *' http://127.0.0.1:3100/health '* ]]
exit "${MOCK_LOOPBACK_EXIT:-0}"
MOCK
cat > "$test_dir/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
# Failed host-readiness retries must not slow this isolated mock test down.
exit 0
MOCK
chmod +x "$test_dir/bin/curl" "$test_dir/bin/sleep"
export PATH="$test_dir/bin:$PATH"
export MOCK_LOG="$test_dir/docker.log"
printf 'API_IMAGE_REPOSITORY=ghcr.io/example/coffee-api\n' > "$test_dir/server/production.env"
old_image="ghcr.io/example/coffee-api@sha256:$(printf '%064d' 1)"
new_image="ghcr.io/example/coffee-api@sha256:$(printf '%064d' 2)"
printf '%s\n' "$old_image" > "$test_dir/server/state/current-image"

if bash "$script_dir/deploy.sh" "$test_dir/server" "ghcr.io/other/coffee-api@sha256:$(printf '%064d' 2)" wrong-package; then
  echo 'Unexpected package was accepted' >&2; exit 1
fi
[[ ! -s "$MOCK_LOG" ]] || { echo 'Docker invoked for an untrusted image' >&2; exit 1; }

export MOCK_MIGRATION_EXIT=1
if bash "$script_dir/deploy.sh" "$test_dir/server" "$new_image" migration-failure; then
  echo 'Migration failure was ignored' >&2; exit 1
fi
[[ $(cat "$MOCK_LOG") != *' up -d --no-deps --wait --wait-timeout 120 api'* ]]
[[ $(cat "$test_dir/server/state/current-image") == "$old_image" ]]
[[ $(cat "$test_dir/server/jobs/migration-failure.status") == 1 ]]

export MOCK_MIGRATION_EXIT=0 MOCK_READINESS_EXIT=1
if bash "$script_dir/deploy.sh" "$test_dir/server" "$new_image" readiness-failure; then
  echo 'Readiness failure was ignored' >&2; exit 1
fi
[[ $(cat "$test_dir/server/state/current-image") == "$old_image" ]]
[[ $(cat "$MOCK_LOG") != *'curl '* ]]

export MOCK_READINESS_EXIT=0
export MOCK_LOOPBACK_EXIT=7
: > "$MOCK_LOG"
if bash "$script_dir/deploy.sh" "$test_dir/server" "$new_image" loopback-failure; then
  echo 'Host loopback readiness failure was ignored' >&2; exit 1
fi
[[ $(cat "$test_dir/server/state/current-image") == "$old_image" ]]
[[ ! -e "$test_dir/server/state/previous-image" ]]
[[ $(cat "$test_dir/server/jobs/loopback-failure.status") == 1 ]]
[[ $(cat "$test_dir/server/state/history.tsv") == *'LOOPBACK_READINESS_FAILED'* ]]
[[ $(grep -c '^curl ' "$MOCK_LOG") == 6 ]]

export MOCK_LOOPBACK_EXIT=0
: > "$MOCK_LOG"
bash "$script_dir/deploy.sh" "$test_dir/server" "$new_image" success
[[ $(cat "$test_dir/server/state/current-image") == "$new_image" ]]
[[ $(cat "$test_dir/server/state/previous-image") == "$old_image" ]]
[[ $(cat "$test_dir/server/jobs/success.status") == 0 ]]
# Inspect execution order across the container/host boundary, not only final files.
awk '
/ run --rm --no-deps migrate$/ { migration = NR }
/ up -d --no-deps --wait --wait-timeout 120 api$/ { api = NR }
/^curl / { host = NR }
END { exit !(migration > 0 && api > migration && host > api) }
' "$MOCK_LOG"
[[ $(cat "$MOCK_LOG") != *caddy* ]]
[[ $(cat "$MOCK_LOG") != *nginx* ]]
echo 'Deploy image validation, migration ordering, container/host readiness failures and successful recording checks passed.'
