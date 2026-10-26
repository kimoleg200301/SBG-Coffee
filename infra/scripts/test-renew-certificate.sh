#!/usr/bin/env bash
# Linux mock test: real flock/hashing, no ACME request or host service changes.
set -Eeuo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d /tmp/sbg-certificate-test-XXXXXXXX)
trap 'rm -rf "$test_dir"' EXIT
mkdir -p "$test_dir/bin" "$test_dir/server/state"
export MOCK_LOG="$test_dir/commands.log"
export MOCK_CERTIFICATE="$test_dir/fullchain.pem"
cat > "$test_dir/bin/runuser" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$*" == '-u bitrix -- /home/bitrix/dehydrated/dehydrated --cron --domain sbg-api.hyundaielevator.kz --config /home/bitrix/dehydrated/config --hook /bin/true' ]]
printf 'acme\n' >> "$MOCK_LOG"
if [[ -n "${MOCK_CERT_CONTENT:-}" ]]; then
  printf '%s\n' "$MOCK_CERT_CONTENT" > "$MOCK_CERTIFICATE"
fi
exit "${MOCK_ACME_EXIT:-0}"
MOCK
cat > "$test_dir/bin/nginx" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$*" == '-t' ]]
printf 'nginx -t\n' >> "$MOCK_LOG"
exit "${MOCK_NGINX_EXIT:-0}"
MOCK
cat > "$test_dir/bin/systemctl" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$*" == 'reload nginx' ]]
printf 'systemctl reload nginx\n' >> "$MOCK_LOG"
exit "${MOCK_RELOAD_EXIT:-0}"
MOCK
chmod +x "$test_dir/bin/"*
export PATH="$test_dir/bin:$PATH"
marker="$test_dir/server/state/certificate-reloaded.sha256"
reload_log=$'acme\nnginx -t\nsystemctl reload nginx'
renew() {
  : > "$MOCK_LOG"
  bash "$script_dir/renew-certificate.sh" "$test_dir/server" "$MOCK_CERTIFICATE"
}
expect_failure() {
  if renew; then
    echo 'Certificate renewal unexpectedly succeeded' >&2
    exit 1
  fi
}
expect_log() {
  [[ "$(cat "$MOCK_LOG")" == "$1" ]] || {
    echo "Unexpected command sequence: $(cat "$MOCK_LOG")" >&2
    exit 1
  }
}
certificate_hash() {
  sha256sum "$MOCK_CERTIFICATE" | cut -d ' ' -f 1
}

# First execution loads the existing certificate, then avoids redundant reloads.
printf 'certificate-v1\n' > "$MOCK_CERTIFICATE"
renew
expect_log "$reload_log"
[[ "$(cat "$marker")" == "$(certificate_hash)" ]]
[[ "$(stat -c '%a' "$marker")" == 600 ]]
renew
expect_log acme

# ACME can replace the certificate; successful reload advances the marker.
export MOCK_CERT_CONTENT=certificate-v2
renew
unset MOCK_CERT_CONTENT
expect_log "$reload_log"
previous_hash=$(certificate_hash)
[[ "$(cat "$marker")" == "$previous_hash" ]]

# Configuration failure must not reload nginx or acknowledge the new certificate.
export MOCK_CERT_CONTENT=certificate-v3 MOCK_NGINX_EXIT=1
expect_failure
unset MOCK_CERT_CONTENT
expect_log $'acme\nnginx -t'
[[ "$(cat "$marker")" == "$previous_hash" ]]

# Reload failure also keeps the old marker. Next time ACME makes no file change:
# the exact same certificate must be retried and acknowledged only on success.
export MOCK_NGINX_EXIT=0 MOCK_RELOAD_EXIT=1
expect_failure
expect_log "$reload_log"
[[ "$(cat "$marker")" == "$previous_hash" ]]
pending_hash=$(certificate_hash)
export MOCK_RELOAD_EXIT=0
renew
expect_log "$reload_log"
[[ "$(certificate_hash)" == "$pending_hash" ]]
[[ "$(cat "$marker")" == "$pending_hash" ]]
renew
expect_log acme

# An ACME failure must stop even if it left a different certificate on disk.
export MOCK_CERT_CONTENT=certificate-v4 MOCK_ACME_EXIT=1
expect_failure
unset MOCK_CERT_CONTENT
expect_log acme
[[ "$(cat "$marker")" == "$pending_hash" ]]
rm "$marker"
expect_failure
expect_log acme
[[ ! -e "$marker" ]]

# Successful ACME exit without a certificate must not touch nginx or the marker.
export MOCK_ACME_EXIT=0
rm "$MOCK_CERTIFICATE"
expect_failure
expect_log acme
[[ ! -e "$marker" ]]

# Hold the real project lock: a concurrent invocation must not run ACME at all.
exec 8>"$test_dir/server/certificate-renewal.lock"
flock -x 8
renew
expect_log ''
[[ ! -e "$marker" ]]
flock -u 8
echo 'Certificate renewal, reload ordering, retry, failure and lock checks passed.'
