#!/usr/bin/env bash
# Exercise the production network topology using a release image and isolated resources.
set -Eeuo pipefail
image=${1:?Usage: test-compose-network.sh API_IMAGE}
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/../.." && pwd)
test_dir=$(mktemp -d /tmp/sbg-compose-network-XXXXXXXX)
project="sbg-network-$(date +%s)-$$"
volume="$project-postgres"
compose=(docker compose --project-name "$project" -f "$test_dir/compose.json")
cleanup() {
  result=$?
  trap - EXIT
  if [[ -f "$test_dir/compose.json" ]]; then
    if (( result != 0 )); then "${compose[@]}" logs --tail 60 || true; fi
    "${compose[@]}" down --timeout 10 >/dev/null || true
    docker volume rm "$volume" >/dev/null 2>&1 || true
  fi
  rm -rf "$test_dir"
  exit "$result"
}
trap cleanup EXIT

# Do not inherit a developer/CI database URL or use the production volume/network names.
API_IMAGE="$image" POSTGRES_USER=sbg POSTGRES_DB=sbg_test \
  POSTGRES_PASSWORD=network-test-only \
  DATABASE_URL='postgresql://sbg:network-test-only@postgres:5432/sbg_test?schema=public' \
  CORS_ORIGINS='' docker compose --profile tools --env-file "$repo_dir/infra/.env.example" \
  -f "$repo_dir/infra/compose.prod.yaml" config --format json > "$test_dir/source.json"
node - "$test_dir/source.json" "$test_dir/compose.json" "$project" "$volume" <<'NODE'
const fs = require('node:fs');
const [source, destination, project, volume] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(source, 'utf8'));
config.name = project;
for (const [key, network] of Object.entries(config.networks)) network.name = `${project}-${key}`;
// Let Docker allocate an isolated bridge; never reuse the host firewall target in tests.
delete config.networks.edge.driver_opts['com.docker.network.bridge.name'];
config.volumes.postgres_data.name = volume;
// An ephemeral host port allows concurrent tests while retaining loopback binding and networks.
config.services.api.ports[0].published = '0';
fs.writeFileSync(destination, JSON.stringify(config));
NODE

"${compose[@]}" up -d --wait --wait-timeout 120 postgres
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 api
endpoint=$("${compose[@]}" port api 3000)
[[ "$endpoint" =~ ^127\.0\.0\.1:[0-9]+$ ]] || {
  echo "Unexpected host binding: $endpoint" >&2; exit 1;
}
curl --noproxy '*' --fail --silent --show-error --max-time 10 \
  "http://$endpoint/health" > "$test_dir/health.json"
curl --noproxy '*' --fail --silent --show-error --max-time 10 \
  "http://$endpoint/api/v1/catalog/products" > "$test_dir/catalog.json"
node - "$test_dir/health.json" "$test_dir/catalog.json" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const [healthFile, catalogFile] = process.argv.slice(2);
const health = JSON.parse(fs.readFileSync(healthFile, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
assert.equal(health.status, 'ok');
assert(Array.isArray(catalog.products));
assert.equal(catalog.products.length, 0); // No demo seed in production topology.
NODE
echo 'Production Compose topology serves health and catalog through its host loopback port.'
