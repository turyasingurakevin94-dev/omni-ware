#!/usr/bin/env bash
# Throwaway local Postgres 16 + PostgREST 12.2.3 (db-max-rows = 1000) with every
# supabase/migrations/*.sql applied, for the real-database probes (bug3_4.js, realfns.js).
# Synthetic data only. Nothing here talks to a hosted Supabase project.
#
#   VERIFY_WORK=/tmp/omni-verify bash docs/verification/2026-10-09/setup-realdb.sh
#
# Needs: postgresql-16 server binaries, psql, curl, npm. Run as root (initdb runs as postgres).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VERIFY_WORK:-/tmp/omni-verify}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
mkdir -p "$WORK/pg" "$WORK/npm" "$WORK/bin"
id postgres >/dev/null 2>&1 || useradd -m postgres
chown -R postgres "$WORK/pg"

if [ ! -x "$WORK/bin/postgrest" ]; then
  curl -sSfL -o "$WORK/bin/pgrst.tar.xz" https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
  tar -C "$WORK/bin" -xJf "$WORK/bin/pgrst.tar.xz"
fi
[ -d "$WORK/npm/node_modules/@supabase/postgrest-js" ] || (cd "$WORK/npm" && npm init -y >/dev/null && npm install --no-audit --no-fund @supabase/supabase-js@2.45.4 >/dev/null)

if [ ! -f "$WORK/pg/data/PG_VERSION" ]; then
  su postgres -c "$PGBIN/initdb -D $WORK/pg/data -U postgres --auth=trust >/dev/null"
fi
su postgres -c "$PGBIN/pg_ctl -D $WORK/pg/data -o '-p 55432 -k $WORK/pg' -l $WORK/pg/log start" </dev/null >/dev/null 2>&1 || true
until psql -q -h 127.0.0.1 -p 55432 -U postgres -c 'select 1' >/dev/null 2>&1; do sleep 1; done

PSQL="psql -q -h 127.0.0.1 -p 55432 -U postgres -v ON_ERROR_STOP=1"
if [ "$($PSQL -At -c "select count(*) from pg_namespace where nspname='auth'")" = "0" ]; then
  $PSQL -f "$HERE/supabase-scaffold.sql"
  fails=0
  for f in "$REPO"/supabase/migrations/*.sql; do
    $PSQL -1 -f "$f" >/dev/null 2>"$WORK/pg/migrate.err" || { fails=$((fails+1)); echo "FAILED: $f"; cat "$WORK/pg/migrate.err"; }
  done
  echo "migrations applied, failures=$fails"
fi

cat > "$WORK/pg/pgrst.conf" <<EOF
db-uri = "postgres://authenticator@127.0.0.1:55432/postgres"
db-schemas = "public"
db-anon-role = "service_role"
db-max-rows = 1000
server-port = 53000
server-host = "127.0.0.1"
EOF
pgrep -f "$WORK/bin/postgrest" >/dev/null || setsid nohup "$WORK/bin/postgrest" "$WORK/pg/pgrst.conf" >"$WORK/pg/pgrst.log" 2>&1 </dev/null &
until curl -s -o /dev/null http://127.0.0.1:53000/; do sleep 1; done
echo "PostgREST up on 127.0.0.1:53000 (max-rows 1000); Postgres on 127.0.0.1:55432"
