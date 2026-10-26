#!/usr/bin/env bash
# Static infrastructure checks; placeholders are deliberately non-secret and never deployed.
set -Eeuo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/../.." && pwd)
for script in "$script_dir"/*.sh; do bash -n "$script"; done
docker compose -f "$repo_dir/infra/compose.dev.yaml" config --quiet
API_IMAGE="ghcr.io/example/example-api@sha256:$(printf '%064d' 0)" \
  docker compose --env-file "$repo_dir/infra/.env.example" \
  -f "$repo_dir/infra/compose.prod.yaml" config --quiet
echo 'Shell syntax and Compose configuration are valid.'
