#!/usr/bin/env bash
# Tests only uniquely named disposable resources created by this invocation.
set -Eeuo pipefail
image=${1:-sbg-coffee-api:local}
suffix="$(date +%s)-$$"
network="sbg-smoke-$suffix"
database="sbg-smoke-db-$suffix"
api="sbg-smoke-api-$suffix"
cleanup() {
  docker rm -f "$api" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
# tmpfs makes the throwaway test database explicit; no existing volume is touched.
docker run -d --name "$database" --network "$network" \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=sbg -e POSTGRES_PASSWORD=smoke-test-only -e POSTGRES_DB=sbg \
  postgres:17.11-bookworm >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$database" pg_isready -U sbg -d sbg >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { docker logs "$database"; exit 1; }
database_url="postgresql://sbg:smoke-test-only@$database:5432/sbg?schema=public"
docker run --rm --network "$network" -e DATABASE_URL="$database_url" "$image" \
  npm run db:migrate --workspace @sbg/api
docker run --rm --network "$network" -e NODE_ENV=test -e DATABASE_URL="$database_url" "$image" \
  node apps/api/dist/prisma/seed.js
docker run --rm --network "$network" -e NODE_ENV=test -e DATABASE_URL="$database_url" "$image" \
  node apps/api/dist/prisma/seed.js

start_api() {
  docker run -d --name "$api" --network "$network" \
    -e DATABASE_URL="$database_url" "$image" >/dev/null
  for ((attempt=0; attempt<60; attempt++)); do
    if docker exec "$api" node -e \
      "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then return; fi
    sleep 1
  done
  docker logs "$api"
  return 1
}
start_api
[[ $(docker exec "$api" id -u) != 0 ]] || { echo 'API must run as a non-root user'; exit 1; }
docker exec "$api" node -e \
  "try{require.resolve('expo');process.exit(1)}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}"
docker exec "$api" node -e \
  "fetch('http://127.0.0.1:3000/api/v1/catalog/products').then(async r=>{const body=await r.json();if(!r.ok||body.products.length!==6)throw new Error('Expected six seeded products');console.log('Catalog:',body.products.length,'products')}).catch(e=>{console.error(e);process.exit(1)})"
snapshot_sql='SELECT row_to_json(p) FROM "Product" p ORDER BY p.id; SELECT row_to_json(v) FROM "ProductVariant" v ORDER BY v.id;'
before=$(docker exec "$database" psql -U sbg -d sbg -Atc "$snapshot_sql")
docker rm -f "$api" >/dev/null
start_api
after=$(docker exec "$database" psql -U sbg -d sbg -Atc "$snapshot_sql")
[[ -n "$before" && "$before" == "$after" ]] || { echo 'Database changed after API replacement'; exit 1; }
docker stop "$database" >/dev/null
docker exec "$api" node -e \
  "fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(10000)}).then(r=>{if(r.status!==503)process.exit(1)}).catch(()=>process.exit(1))"
echo 'Container migration, repeat seed, catalogue, readiness and data preservation checks passed.'
