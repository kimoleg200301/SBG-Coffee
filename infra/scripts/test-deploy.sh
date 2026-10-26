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

export MOCK_READINESS_EXIT=0
bash "$script_dir/deploy.sh" "$test_dir/server" "$new_image" success
[[ $(cat "$test_dir/server/state/current-image") == "$new_image" ]]
[[ $(cat "$test_dir/server/state/previous-image") == "$old_image" ]]
[[ $(cat "$test_dir/server/jobs/success.status") == 0 ]]
echo 'Deploy package validation, migration failure, readiness failure and successful recording checks passed.'
