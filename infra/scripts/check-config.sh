#!/usr/bin/env bash
# Static infrastructure checks; placeholders are deliberately non-secret and never deployed.
set -Eeuo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/../.." && pwd)
for script in "$script_dir"/*.sh; do bash -n "$script"; done
docker compose -f "$repo_dir/infra/compose.dev.yaml" config --quiet
API_IMAGE="ghcr.io/example/example-api@sha256:$(printf '%064d' 0)" \
  docker compose --profile tools --env-file "$repo_dir/infra/.env.example" \
  -f "$repo_dir/infra/compose.prod.yaml" config --format json | node -e '
const assert = require("node:assert/strict");
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const config = JSON.parse(input);
  const { api, postgres, migrate } = config.services;
  assert.deepEqual(Object.keys(config.services).sort(), ["api", "migrate", "postgres"]);
  assert.equal(api.ports.length, 1);
  assert.equal(api.ports[0].host_ip, "127.0.0.1");
  assert.equal(String(api.ports[0].published), "3100");
  assert.equal(api.ports[0].target, 3000);
  assert.equal(api.ports[0].protocol, "tcp");
  assert.deepEqual(Object.keys(api.networks).sort(), ["backend", "edge"]);
  for (const service of [postgres, migrate]) {
    assert.equal((service.ports ?? []).length, 0);
    assert.deepEqual(Object.keys(service.networks), ["backend"]);
  }
  assert.equal(config.networks.backend.internal, true);
  assert.notEqual(config.networks.edge.internal, true);
  assert.equal(config.volumes.postgres_data.name, "sbg-coffee-production-postgres");
  assert(postgres.volumes.some(volume => volume.type === "volume" &&
    volume.source === "postgres_data" && volume.target === "/var/lib/postgresql/data"));
});'
echo 'Shell syntax, Compose configuration, host port and database isolation checks passed.'
