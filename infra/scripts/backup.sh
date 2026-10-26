#!/usr/bin/env bash
# A consistent logical backup; send it to independent encrypted storage afterward.
set -Eeuo pipefail
umask 077
deployment_dir=${1:?Usage: backup.sh DEPLOY_PATH OUTPUT_DIRECTORY}
output_dir=${2:?Choose a backup output directory}
image=$(cat "$deployment_dir/state/current-image")
compose_file=$(cat "$deployment_dir/state/current-compose")
mkdir -p "$output_dir"
destination="$output_dir/sbg-$(date -u +%Y%m%dT%H%M%SZ).dump"
export API_IMAGE="$image"
docker compose --project-name sbg-coffee-production --env-file "$deployment_dir/production.env" \
  -f "$compose_file" exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$destination.part"
mv "$destination.part" "$destination"
echo "$destination"
