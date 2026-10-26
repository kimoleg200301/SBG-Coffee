#!/usr/bin/env bash
# Exercise the real host templates with nginx 1.24, without touching host nginx.
set -Eeuo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/../.." && pwd)
for dependency in docker curl openssl node; do
  command -v "$dependency" >/dev/null || { echo "Missing dependency: $dependency" >&2; exit 1; }
done
test_dir=$(mktemp -d /tmp/sbg-nginx-test-XXXXXXXX)
nginx_container="$(basename "$test_dir")-nginx"
upstream_container="$(basename "$test_dir")-upstream"
domain=sbg-api.hyundaielevator.kz
cert_dir="$test_dir/certs/$domain"
cleanup() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    docker logs "$nginx_container" >&2 2>/dev/null || true
    docker logs "$upstream_container" >&2 2>/dev/null || true
  fi
  docker rm -f "$upstream_container" "$nginx_container" >/dev/null 2>&1 || true
  rm -rf "$test_dir"
  return "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -p "$test_dir/nginx/bx/site_ext_enabled" "$test_dir/nginx/bx/conf" \
  "$test_dir/nginx/ssl" "$test_dir/challenges" "$cert_dir"
cat > "$test_dir/nginx/nginx.conf" <<'NGINX'
events {}
http {
    access_log /dev/stdout;
    error_log /dev/stderr;
    include /etc/nginx/bx/site_ext_enabled/*.conf;
}
NGINX
# Fixtures follow the existing host's challenge alias and shared SSL directives.
cat > "$test_dir/nginx/bx/conf/letsencrypt-challenge-tokens.conf" <<'NGINX'
location /.well-known/acme-challenge {
    alias /var/www/dehydrated;
    default_type "text/plain";
}
NGINX
cat > "$test_dir/nginx/bx/conf/ssl_options.conf" <<'NGINX'
error_page 497 https://$host$request_uri;
keepalive_timeout 70;
keepalive_requests 150;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
NGINX
cp "$repo_dir/infra/nginx/sbg-api.http.conf" "$test_dir/nginx/bx/site_ext_enabled/"
printf 'sbg-nginx-challenge-proof\n' > "$test_dir/challenges/sbg-test-token"
[[ ! -f "$cert_dir/fullchain.pem" ]]
docker run -d --name "$nginx_container" \
  --publish 127.0.0.1::80 --publish 127.0.0.1::443 \
  --mount "type=bind,source=$test_dir/nginx,target=/etc/nginx,readonly" \
  --mount "type=bind,source=$test_dir/challenges,target=/var/www/dehydrated,readonly" \
  --mount "type=bind,source=$test_dir/certs,target=/home/bitrix/dehydrated/certs,readonly" \
  --entrypoint nginx nginx:1.24.0-alpine -g 'daemon off;' >/dev/null
docker exec "$nginx_container" nginx -t
http_port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$nginx_container")
https_port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "443/tcp") 0).HostPort}}' "$nginx_container")
http_curl=(curl --noproxy '*' --silent --show-error --max-time 5 --resolve "$domain:$http_port:127.0.0.1")
assert_http() {
  local code
  code=$("${http_curl[@]}" --dump-header "$test_dir/headers" --output "$test_dir/body" \
    --write-out '%{http_code}' "http://$domain:$http_port/.well-known/acme-challenge/sbg-test-token")
  [[ "$code" == 200 ]]
  cmp "$test_dir/body" "$test_dir/challenges/sbg-test-token"
  node - "$test_dir/headers" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
assert.doesNotMatch(fs.readFileSync(process.argv[2], 'utf8'), /^location:/im);
NODE
  code=$("${http_curl[@]}" --dump-header "$test_dir/headers" --output /dev/null \
    --write-out '%{http_code}' "http://$domain:$http_port/api/v1/catalog/products?search=flat%20white")
  [[ "$code" == 301 ]]
  node - "$test_dir/headers" "$domain" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const headers = fs.readFileSync(process.argv[2], 'utf8');
assert.equal(headers.match(/^location: (.+)\r?$/im)?.[1].trim(),
  `https://${process.argv[3]}/api/v1/catalog/products?search=flat%20white`);
NODE
}
assert_http
echo 'HTTP bootstrap syntax, ACME 200 and HTTPS redirect passed without a certificate.'

# Only temporary local certificates are generated. No real ACME request is made.
cat > "$test_dir/certificate.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = extensions
prompt = no
[dn]
CN = $domain
[extensions]
subjectAltName = DNS:$domain
EOF
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -config "$test_dir/certificate.cnf" \
  -keyout "$cert_dir/privkey.pem" -out "$cert_dir/fullchain.pem" >/dev/null 2>&1
cp "$cert_dir/fullchain.pem" "$cert_dir/chain.pem"
openssl dhparam -out "$test_dir/nginx/ssl/dhparam.pem" 2048 >/dev/null 2>&1
cat > "$test_dir/upstream.js" <<'NODE'
const http = require('node:http');
http.createServer((request, response) => {
  const validPath = request.url === '/health' || request.url.startsWith('/api/v1/catalog/products?');
  response.writeHead(validPath ? 200 : 404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({
    status: validPath ? 'ok' : 'wrong path',
    url: request.url,
    httpVersion: request.httpVersion,
    headers: request.headers,
  }));
}).listen(3100, '127.0.0.1');
NODE
# Sharing this disposable namespace makes the unchanged 127.0.0.1:3100 upstream
# behave like the real host, without binding 3100 or changing other containers.
docker run -d --name "$upstream_container" --network "container:$nginx_container" \
  --mount "type=bind,source=$test_dir/upstream.js,target=/tmp/upstream.js,readonly" \
  node:22-bookworm-slim node /tmp/upstream.js >/dev/null
cp "$repo_dir/infra/nginx/sbg-api.https.conf" "$test_dir/nginx/bx/site_ext_enabled/"
docker exec "$nginx_container" nginx -t
docker exec "$nginx_container" nginx -s reload
https_curl=(curl --noproxy '*' --silent --show-error --fail --max-time 5 \
  --cacert "$cert_dir/fullchain.pem" --resolve "$domain:$https_port:127.0.0.1")
ready=false
for ((attempt = 0; attempt < 30; attempt++)); do
  if "${https_curl[@]}" "https://$domain:$https_port/health" > "$test_dir/health.json" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'HTTPS upstream did not become ready' >&2; exit 1; }
assert_http
"${https_curl[@]}" -H 'X-Forwarded-For: 198.51.100.23' -H 'X-Real-IP: 198.51.100.99' \
  -H 'X-Forwarded-Proto: http' \
  "https://$domain:$https_port/api/v1/catalog/products?category=coffee&search=flat%20white&tag=a%2Fb" \
  > "$test_dir/catalog.json"
node - "$test_dir/health.json" "$test_dir/catalog.json" "$domain" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const health = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const catalog = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
assert.equal(health.status, 'ok');
assert.equal(health.url, '/health');
assert.equal(catalog.status, 'ok');
assert.equal(catalog.url, '/api/v1/catalog/products?category=coffee&search=flat%20white&tag=a%2Fb');
for (const response of [health, catalog]) {
  assert.equal(response.httpVersion, '1.1');
  assert.equal(response.headers.host, process.argv[4]);
  assert.equal(response.headers['x-forwarded-proto'], 'https');
  assert.ok(net.isIP(response.headers['x-real-ip']));
  assert.notEqual(response.headers['x-real-ip'], '198.51.100.99');
}
assert.equal(catalog.headers['x-forwarded-for'], `198.51.100.23, ${catalog.headers['x-real-ip']}`);
NODE
echo 'HTTPS syntax/TLS, retained ACME route, health, API path/query and forwarded headers passed.'
