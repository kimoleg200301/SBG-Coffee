#!/usr/bin/env bash
# Runs on Linux server. Every release uses the same project/volume and server env file.
set -Eeuo pipefail
umask 077

deployment_dir=${1:?Usage: deploy.sh DEPLOY_PATH IMAGE@sha256:DIGEST RUN_ID}
requested_image=${2:?A full immutable image reference is required}
run_id=${3:?A unique run ID is required}
[[ "$deployment_dir" =~ ^/[A-Za-z0-9/_-]+$ ]] || { echo 'Invalid deployment path' >&2; exit 2; }
[[ "$run_id" =~ ^[A-Za-z0-9_-]+$ ]] || { echo 'Invalid run ID' >&2; exit 2; }
mkdir -p "$deployment_dir/state" "$deployment_dir/jobs"
status_file="$deployment_dir/jobs/$run_id.status"
printf 'running\n' > "$status_file"
finish() {
  result=$?
  printf '%s\n' "$result" > "$status_file.tmp"
  mv "$status_file.tmp" "$status_file"
}
trap finish EXIT
# A disconnected observer must not interrupt an in-flight database migration.
trap '' HUP

for executable in docker flock curl; do
  command -v "$executable" >/dev/null || { echo "Missing command: $executable" >&2; exit 2; }
done
exec 9>"$deployment_dir/deploy.lock"
flock -x 9

server_env="$deployment_dir/production.env"
[[ -f "$server_env" ]] || { echo "Missing $server_env" >&2; exit 2; }
expected_repository=$(sed -n 's/^API_IMAGE_REPOSITORY=//p' "$server_env")
[[ "$expected_repository" =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*-api$ ]] || {
  echo 'Set one unquoted API_IMAGE_REPOSITORY=ghcr.io/owner/repository-api in production.env' >&2
  exit 2
}
if [[ "$requested_image" != "$expected_repository@sha256:"* ]] || \
  [[ ! "${requested_image#"$expected_repository@sha256:"}" =~ ^[a-f0-9]{64}$ ]]; then
  echo 'Image must be a sha256 digest from the configured GHCR package' >&2
  exit 2
fi
export API_IMAGE="$requested_image"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
compose_file="$script_dir/../compose.prod.yaml"
compose=(docker compose --project-name sbg-coffee-production --env-file "$server_env" -f "$compose_file")
"${compose[@]}" config --quiet
previous_image=''
if [[ -f "$deployment_dir/state/current-image" ]]; then
  previous_image=$(cat "$deployment_dir/state/current-image")
fi
record() {
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$run_id" "$1" "$requested_image" \
    >> "$deployment_dir/state/history.tsv"
}
record STARTED
# Other applications may have unrelated/stale GHCR credentials in root's config.
# Isolate registry authentication, but keep Compose's installed CLI plugin/context.
registry_dir="$deployment_dir/registry"
mkdir -p "$registry_dir"
chmod 700 "$registry_dir"
docker --config "$registry_dir" pull "$requested_image"

# Never recreate a database container during an application rollout.
"${compose[@]}" up -d --no-recreate --wait --wait-timeout 120 postgres
# These variables are expanded by the container shell, not the host.
# shellcheck disable=SC2016
"${compose[@]}" exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# This command is deliberately completed before touching the running API.
# Prisma's migration lock also protects against a second external migration process.
if ! "${compose[@]}" run --rm --no-deps migrate; then
  record MIGRATION_FAILED
  echo 'Migration failed; the previous API container was not replaced.' >&2
  exit 1
fi
record MIGRATIONS_APPLIED

if ! "${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api; then
  record READINESS_FAILED
  echo 'New API is not ready. Inspect logs and explicitly roll back to the last successful digest.' >&2
  echo "Last successful image: ${previous_image:-none}" >&2
  exit 1
fi
# Container health alone does not prove that host nginx can reach the published port.
# Keep options compatible with the existing CentOS curl; retry in Bash with a bound.
loopback_ready=false
for attempt in 1 2 3 4 5 6; do
  if curl --noproxy '*' --fail --silent --show-error --connect-timeout 5 --max-time 5 \
    --output /dev/null http://127.0.0.1:3100/health; then
    loopback_ready=true
    break
  fi
  [[ "$attempt" == 6 ]] || sleep 2
done
if [[ "$loopback_ready" != true ]]; then
  record LOOPBACK_READINESS_FAILED
  echo 'API container is healthy, but host nginx cannot reach 127.0.0.1:3100/health.' >&2
  echo "Last successful image: ${previous_image:-none}" >&2
  exit 1
fi
# Host nginx and certificate renewal are configured separately, never by a release.
if [[ -n "$previous_image" && "$previous_image" != "$requested_image" ]]; then
  printf '%s\n' "$previous_image" > "$deployment_dir/state/previous-image"
fi
printf '%s\n' "$requested_image" > "$deployment_dir/state/current-image.tmp"
mv "$deployment_dir/state/current-image.tmp" "$deployment_dir/state/current-image"
printf '%s\n' "$compose_file" > "$deployment_dir/state/current-compose"
record SUCCEEDED
echo "Deployed $requested_image"
