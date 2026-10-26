#!/usr/bin/env bash
# Run as root. Optional paths allow isolated tests; the ACME domain is always fixed.
set -Eeuo pipefail
umask 077

domain=sbg-api.hyundaielevator.kz
deployment_dir=${1:-/opt/sbg-coffee}
fullchain=${2:-/home/bitrix/dehydrated/certs/$domain/fullchain.pem}
[[ "$deployment_dir" == /* && "$fullchain" == /* ]] || {
  echo 'Deployment and fullchain paths must be absolute' >&2
  exit 2
}
for executable in flock runuser sha256sum nginx systemctl; do
  command -v "$executable" >/dev/null || { echo "Missing command: $executable" >&2; exit 2; }
done
mkdir -p "$deployment_dir/state"
exec 9>"$deployment_dir/certificate-renewal.lock"
if ! flock -n 9; then
  echo 'Certificate renewal is already running; skipping.'
  exit 0
fi

# Keep certificate ownership and shared configuration intact. The shared hook
# reloads nginx itself, so bypass it and validate/reload explicitly as root below.
runuser -u bitrix -- /home/bitrix/dehydrated/dehydrated \
  --cron --domain "$domain" --config /home/bitrix/dehydrated/config --hook /bin/true
[[ -f "$fullchain" && -s "$fullchain" ]] || {
  echo "Missing or empty certificate: $fullchain" >&2
  exit 1
}
fingerprint=$(sha256sum -- "$fullchain")
fingerprint=${fingerprint%% *}
marker="$deployment_dir/state/certificate-reloaded.sha256"
if [[ -f "$marker" && "$(cat "$marker")" == "$fingerprint" ]]; then
  echo 'Certificate is already loaded by nginx.'
  exit 0
fi

# Record only a successful reload. An unchanged certificate is retried after a
# failed validation/reload because the previous fingerprint remains on disk.
nginx -t
systemctl reload nginx
marker_tmp=$(mktemp "$marker.tmp.XXXXXXXX")
trap 'rm -f -- "$marker_tmp"' EXIT
printf '%s\n' "$fingerprint" > "$marker_tmp"
mv -- "$marker_tmp" "$marker"
echo "Certificate loaded by nginx for $domain."
