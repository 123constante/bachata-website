#!/usr/bin/env bash
# provision-acer-web.sh -- one-shot wave 0 provisioning of the Website runner "acer-web" on the Acer.
# Source of truth: docs/ci-offload/acer-web/provision-checklist.md and docs/handover/ci-offload-stage3.md
# ("The runner (exact, Acer)") at 123constante/bachata-website commit 14e26e7c5 (PR #1470).
# Run as root:   sudo bash provision-acer-web.sh        (optional 20 min mutant run: sudo RUN_MUTANTS=1 bash ...)
# It asks for the one-time runner registration token (hidden; never stored in a file).
# Scope: wave 0 only (bom-check.yml). Node 22 / npm 11 / Playwright (waves 2-3) are NOT installed here.
# It prints everything it will change and waits for "yes" first. It stops at the first problem.
# Re-run: if it stopped AFTER the runner was registered, just run it again: it skips download and
# registration and continues with the lock-down, unit, DNS proof and start.
set -euo pipefail

COMMIT=14e26e7c5f59cbe14534a724d1bdbb21cbd2f267
REPO_URL=https://github.com/123constante/bachata-website.git
RUNNER_USER=ghrunner-web
RUNNER_HOME=/srv/ghrunner-web
RUNNER_DIR=$RUNNER_HOME/runner
STATE_DIR=$RUNNER_HOME/state
HOOK_DIR=/usr/local/lib/ghrunner-web/hooks
UNIT=actions.runner.bachata-website.acer-web.service
WALK_DIR=/var/lib/laptop-walk

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nSTOP: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root: sudo bash $0"
[ "$(uname -m)" = x86_64 ] || die "this script downloads the linux-x64 runner; this machine is $(uname -m)"
command -v apt-get >/dev/null || die "apt-get not found (Ubuntu/Debian expected)"
[ -d /run/systemd/system ] || die "systemd is not running as init on this machine"
RESUME=0; [ -e "$RUNNER_DIR/.runner" ] && RESUME=1
if [ "$RESUME" = 1 ] && systemctl is-enabled --quiet "$UNIT" 2>/dev/null; then
  die "already provisioned and enabled; nothing changed (edit by hand to change anything, so later waves' allow-list and limits are not reset)"
fi
[ "$RESUME" = 1 ] && { systemctl stop "$UNIT" 2>/dev/null || true; }
for ns in $(awk '/^nameserver/{print $2}' /etc/resolv.conf); do
  case "$ns" in *%*) die "resolver $ns has a zone id (%); tell Claude, the unit needs a plain address";; esac
done

say "What this will change on this machine"
cat <<EOF
 - apt: update, then install git util-linux coreutils python3 curl ca-certificates (and the runner's own
   dependencies via its installdependencies.sh)
 - a system user and group:  $RUNNER_USER (no login, no sudo) and group laptop-walk
 - folders: $RUNNER_HOME (runner, state), $HOOK_DIR, /etc/ghrunner-web, $WALK_DIR (kept as is if it exists)
 - files: the two hooks (root-owned 0755), /etc/ghrunner-web/workflows.allow, /etc/systemd/system/$UNIT
 - downloads the GitHub Actions runner (checksum-verified), registers it as "acer-web" on your Website repo
 - starts the service. It does NOT touch your other runners, repos, SSH, firewall or anything under /home.
 - $( [ $RESUME = 1 ] && echo "RESUME MODE: a runner is already registered here, so download + registration are skipped" || echo "fresh install" )
EOF
printf 'Type yes to continue: '; read -r ans; [ "$ans" = yes ] || die "not confirmed; nothing changed"

say "0. Machine facts (for the record)"
. /etc/os-release 2>/dev/null && echo "OS: ${PRETTY_NAME:-unknown}" || true
echo "bash: $(bash --version | head -1)"; free -m | sed -n '1,2p'
echo "nameservers: $(grep '^nameserver' /etc/resolv.conf | tr '\n' ' ')"

say "1. Tools (git, util-linux, coreutils, python3, curl, ca-certificates)"
apt-get -o DPkg::Lock::Timeout=180 update -qq
DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=180 install -y -qq git util-linux coreutils python3 curl ca-certificates >/dev/null
gmaj=$(git --version | sed -E 's/[^0-9]*([0-9]+)\.([0-9]+).*/\1/'); gmin=$(git --version | sed -E 's/[^0-9]*([0-9]+)\.([0-9]+).*/\2/')
case "$gmaj$gmin" in ''|*[!0-9]*) die "cannot read the git version: $(git --version)";; esac
{ [ "$gmaj" -gt 2 ] || { [ "$gmaj" -eq 2 ] && [ "$gmin" -ge 32 ]; }; } || die "git is $(git --version); 2.32 or newer is required"
for b in /bin/bash /usr/bin/env; do [ -x "$b" ] || die "$b is missing"; done
python3 -I -c 'import json' || die "python3 json module missing"
echo "git: $(git --version)"

say "2. Fetch the merged files at the approved commit and verify them"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
git init -q "$W/src"
env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/nonexistent git -C "$W/src" fetch -q --depth 1 "$REPO_URL" "$COMMIT"
git -C "$W/src" checkout -q FETCH_HEAD
[ "$(git -C "$W/src" rev-parse HEAD)" = "$COMMIT" ] || die "fetched commit is not $COMMIT"
A="$W/src/docs/ci-offload/acer-web"; C="$W/clean"; mkdir "$C"
for f in gate-job-started.sh gate-job-completed.sh workflows.allow test-gate-hooks.sh; do tr -d '\r' < "$A/$f" > "$C/$f"; done
tr -d '\r' < "$A/actions.runner.bachata-website.acer-web.service" > "$C/$UNIT"
cat > "$W/sums" <<'EOF'
6d1e630de58e619b25ca1286399cff448a440caf8f6d23d4c4178eaeec58b7e6  gate-job-started.sh
f34e835c0d8b1a4a817591eb3679c7f51ae86d97f2f8d29617cfe187c9db5cab  gate-job-completed.sh
1d2f453f68ae2a3f6de8aad67e74604e9d2058fca2c0ee8b01a48a5b609e60c4  workflows.allow
76e258f73f8c6e9ea31420ca42d524a3484db081a78dfbab2fa3ecc7edc7a5a6  actions.runner.bachata-website.acer-web.service
9f08c9a61a16bd7b0d1bbc31b48bd7a98f43719aff62e03033af0f65d981d155  test-gate-hooks.sh
EOF
( cd "$C" && sha256sum -c "$W/sums" ) || die "a file differs from the approved PR #1470 content"

say "3. Run the hook suite with THIS machine's own tools (checklist section 6)"
echo "env: $(/usr/bin/env --version | head -1)"; echo "timeout: $(timeout --version | head -1)"
# The suite is hermetic (all paths under its own mktemp dir). It runs from the checkout; the commit pin
# plus the checksums above make those the same bytes as the verified copies.
if ! bash "$A/test-gate-hooks.sh" > "$W/suite.out" 2>&1; then
  grep -m10 '^FAIL' "$W/suite.out" || tail -15 "$W/suite.out"
  die "the hook suite FAILED on this machine. Do not register the runner. Send the lines above to Claude."
fi
tail -1 "$W/suite.out"
if [ "${RUN_MUTANTS:-0}" = 1 ]; then
  bash "$A/test-gate-hooks.sh" --mutants > "$W/mut.out" 2>&1 || { grep -m10 '^FAIL' "$W/mut.out"; die "mutants not all caught"; }
  tail -1 "$W/mut.out"
else
  echo "(mutant run skipped; it already passed 36/36 on the Dell. Use: sudo RUN_MUTANTS=1 bash $0 for about 20 min)"
fi

say "4. Users, groups, folders, hooks"
getent group laptop-walk >/dev/null || groupadd --system laptop-walk
if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$RUNNER_HOME" --shell /usr/sbin/nologin "$RUNNER_USER"
  chown root:root "$RUNNER_HOME"; chmod 0755 "$RUNNER_HOME"
fi
usermod -aG laptop-walk "$RUNNER_USER"
if [ -d "$WALK_DIR" ]; then
  echo "$WALK_DIR already exists, left as is: $(stat -c '%A %U:%G' "$WALK_DIR")  (the walk tooling must be able to write there)"
else
  install -d -o root -g laptop-walk -m 2775 "$WALK_DIR"
fi
printf 'Linux username that runs your Acer walks/tests (to add to group laptop-walk; Enter to skip): '; read -r WALKUSER
if [ -n "$WALKUSER" ]; then id "$WALKUSER" >/dev/null 2>&1 && usermod -aG laptop-walk "$WALKUSER" && echo "added $WALKUSER to laptop-walk (they must log in again)" || echo "no such user: $WALKUSER (skipped)"; fi
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0700 "$STATE_DIR"
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0755 "$RUNNER_DIR"
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0755 "$RUNNER_DIR/_work"
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0700 "$RUNNER_DIR/_work/_home"
install -d -o root -g root -m 0755 /usr/local/lib/ghrunner-web "$HOOK_DIR" /etc/ghrunner-web
install -o root -g root -m 0755 "$C/gate-job-started.sh" "$C/gate-job-completed.sh" "$HOOK_DIR/"
install -o root -g root -m 0644 "$C/workflows.allow" /etc/ghrunner-web/workflows.allow
ls -l "$HOOK_DIR" /etc/ghrunner-web/workflows.allow

sudo_u() { runuser -u "$RUNNER_USER" -- env HOME="$RUNNER_DIR/_work/_home" "$@"; }

if [ "$RESUME" = 1 ]; then
  say "5-6. Skipped (resume mode): the runner is already registered here"
else
  say "5. Download the GitHub Actions runner and verify its checksum"
  json=$(curl -fsSL --proto '=https' --tlsv1.2 https://api.github.com/repos/actions/runner/releases/latest) || die "could not read the runner release from GitHub (rate limit? try again in a few minutes)"
  ver=$(printf '%s' "$json" | python3 -I -c 'import json,sys;print(json.load(sys.stdin)["tag_name"].lstrip("v"))')
  printf '%s' "$ver" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "unexpected runner version string: $ver"
  want=$(printf '%s' "$json" | python3 -I -c 'import json,re,sys;b=json.load(sys.stdin)["body"];m=re.search(r"<!-- BEGIN SHA linux-x64 -->([0-9a-f]{64})<!-- END SHA linux-x64 -->",b);print(m.group(1) if m else "")')
  [ -n "$want" ] || die "could not read the linux-x64 checksum from the runner release notes"
  tgz="actions-runner-linux-x64-$ver.tar.gz"
  curl -fsSL --proto '=https' --tlsv1.2 -o "$W/$tgz" "https://github.com/actions/runner/releases/download/v$ver/$tgz"
  [ "$(sha256sum "$W/$tgz" | cut -d' ' -f1)" = "$want" ] || die "runner download checksum mismatch"
  tar -xzf "$W/$tgz" -C "$RUNNER_DIR"; chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"
  "$RUNNER_DIR/bin/installdependencies.sh" >/dev/null 2>&1 || die "the runner's dependency installer failed; run $RUNNER_DIR/bin/installdependencies.sh by hand and send Claude the output"
  echo "runner v$ver verified and unpacked"

  say "6. Register the runner (needs the one-time token you minted on GitHub)"
  printf 'Paste the runner registration token (input hidden), then press Enter: '
  read -rs TOKEN; echo
  TOKEN=${TOKEN//[[:space:]]/}
  [ -n "$TOKEN" ] || die "no token entered"
  if ! sudo_u "$RUNNER_DIR/config.sh" --unattended --disableupdate --replace --url https://github.com/123constante/bachata-website \
      --token "$TOKEN" --name acer-web --labels acer-web --runnergroup Default --work _work; then
    unset TOKEN; die "registration failed (token expired or typed wrong?). Mint a new token and run this script again."
  fi
  unset TOKEN
fi

say "6b. Lock the runner folder: root owns everything except _work and _diag"
sudo_u mkdir -p "$RUNNER_DIR/_work" "$RUNNER_DIR/_diag"
chown -R "root:$RUNNER_USER" "$RUNNER_DIR"; chmod -R g-w,o-rwx "$RUNNER_DIR"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR/_work" "$RUNNER_DIR/_diag"
for f in .credentials .credentials_rsaparams .runner; do [ -e "$RUNNER_DIR/$f" ] && chmod 0640 "$RUNNER_DIR/$f"; done
[ -e "$RUNNER_DIR/.runner" ] || die "registration left no .runner file; send Claude this message"

say "7. Systemd unit + network check (checklist section 4)"
install -m 0644 "$C/$UNIT" "/etc/systemd/system/$UNIT"
lan=""
for ns in $(awk '/^nameserver/{print $2}' /etc/resolv.conf); do
  case "$ns" in
    127.*|::1) ;;
    10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|169.254.*|100.6[4-9].*|100.[7-9][0-9].*|100.1[01][0-9].*|100.12[0-7].*|fc*|fd*|fe[89abAB]*) lan="$lan $ns" ;;
  esac
done
UF=/etc/systemd/system/$UNIT
if [ -n "$lan" ] && ! grep -q '^IPAddressAllow=' "$UF"; then
  echo "LAN resolver(s) found:$lan -> allowing exactly these address(es) in the unit"
  for ns in $lan; do printf 'IPAddressAllow=%s\n' "$ns"; done > "$W/allow.lines"
  python3 -I - "$W/allow.lines" "$UF" <<'PY'
import sys
lines=open(sys.argv[1]).read()
p=sys.argv[2]; t=open(p).read()
mark="# IPAddressAllow=192.168.1.1\n"
assert mark in t, "marker line not found in unit"
open(p,"w").write(t.replace(mark, mark+lines,1))
PY
elif [ -z "$lan" ]; then echo "resolver is loopback or public: nothing to allow"; fi
systemctl daemon-reload
DENY=$(grep '^IPAddressDeny=' "$UF" | head -1 | cut -d= -f2-)
[ -n "$DENY" ] || die "no IPAddressDeny line in the installed unit"
allow_args=(); for ns in $(grep '^IPAddressAllow=' "$UF" | cut -d= -f2-); do allow_args+=(-p "IPAddressAllow=$ns"); done
# Same restrictions as the unit that matter for name lookups and git.
proof_args=(--wait --pipe --uid="$RUNNER_USER" -p "IPAddressDeny=$DENY" -p "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6"
  -p PrivateDevices=yes -p ProtectSystem=strict -p NoNewPrivileges=yes -p ProtectProc=invisible ${allow_args[@]+"${allow_args[@]}"})
echo "name lookups under the runner's network filter:"
out=$(systemd-run "${proof_args[@]}" bash -c 'getent ahostsv4 github.com | grep -m1 STREAM; getent ahostsv4 registry.npmjs.org | grep -m1 STREAM' 2>&1) || true
[ "$(printf '%s\n' "$out" | grep -c 'STREAM')" -ge 2 ] \
  || { printf '%s\n' "$out" | tail -8; die "name lookup FAILS under the runner's network filter. The runner is registered but NOT started. Send this output to Claude. (Re-run this script after it is fixed.)"; }
printf '%s\n' "$out" | grep STREAM
gw=$(ip route 2>/dev/null | awk '/^default/{print $3; exit}' || true)
if [ -n "$gw" ] && ! printf '%s\n' $lan | grep -qx "$gw"; then
  if lo=$(systemd-run "${proof_args[@]}" timeout 5 bash -c "echo > /dev/tcp/$gw/80" 2>&1); then
    die "the LAN (your router $gw) is REACHABLE under the filter; it must be closed. The runner is NOT started. Send this to Claude."
  elif printf '%s' "$lo" | grep -qi 'not permitted'; then echo "ok: the LAN ($gw) is blocked by the runner's filter"
  else echo "WARNING: connection to $gw failed but not by the filter ($(printf '%s' "$lo" | tail -1 | cut -c1-100)); the LAN-closed check is inconclusive. Tell Claude."; fi
else echo "(LAN-closed check skipped: no default gateway found, or it is also the DNS resolver)"; fi

say "8. Start"
systemctl enable --now "$UNIT" || true
sleep 10
systemctl is-active "$UNIT" || { journalctl -u "$UNIT" -n 25 --no-pager; die "the service is not active (log above). Send it to Claude, then run this script again."; }
journalctl -u "$UNIT" -n 8 --no-pager | cut -c1-200
echo; echo "DONE. Runner acer-web is registered and running. Tell Claude 'acer done'; Claude verifies from GitHub."
echo "RAM for the record (MemoryMax stays 4G until wave 1 measures):"; free -m | sed -n '1,2p'
