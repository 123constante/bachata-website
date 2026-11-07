# Acer (and Dell) web runner: provisioning checklist (CI offload wave 0)

What the owner installs **as root, once, before** the runner is registered or any workflow beyond
`bom-check.yml` is added to `workflows.allow`. The runner user `ghrunner-web` has no sudo and the
unit keeps `NoNewPrivileges=yes` + `ProtectSystem=strict`, so a routed job can never install
anything system-wide itself: whatever is missing here makes the routed job fail, and the required
hosted job then runs the check (the PR stays green, the minutes are simply not saved).

Unit: `actions.runner.bachata-website.acer-web.service` (this folder). Hooks + allow-list:
`gate-job-started.sh`, `gate-job-completed.sh` -> `/usr/local/lib/ghrunner-web/hooks/` (root:root
0755); `workflows.allow` -> `/etc/ghrunner-web/workflows.allow` (root:root 0644).

## 1. Tools (root, system-wide, read-only to the runner)

| need | why | install (Ubuntu/Debian) | check as the runner user |
|---|---|---|---|
| git, flock/setsid (util-linux), coreutils `timeout` | the hooks | `apt-get install -y git util-linux coreutils` | `sudo -u ghrunner-web bash -c 'command -v git flock setsid timeout'` |
| python3 (stdlib `json`) | the hook's `read_event_payload` (no python3 = every job refused, hosted runs it) | `apt-get install -y python3` | `sudo -u ghrunner-web python3 -I -c 'import json'` |
| python3-yaml | `architecture-guard.yml`, `scripts/integrity-guard.py` (`import yaml`) | `apt-get install -y python3-yaml` | `sudo -u ghrunner-web python3 -c 'import yaml'` |
| Node 22 + npm 11 | the workflows run `npm install -g npm@11`; a global install is NOT writable for the runner, so npm 11 must already be the system npm | NodeSource or the official tarball into `/usr/local`, then `npm install -g npm@11` **as root** | `sudo -u ghrunner-web npm -v` prints `11.x` |
| Playwright chromium + OS libs | e2e jobs (waves 2-3); the unit sets `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` | see section 2 | see section 2 |

Routed jobs whose workflow step runs `npm install -g npm@11` will fail on the runner (read-only
prefix). Before such a workflow is added to `workflows.allow`, its routed job must skip that step
when `npm -v` already prints 11 (wave 1 work, a workflow edit; not this PR).

## 2. Playwright browsers on a read-only path (`PLAYWRIGHT_BROWSERS_PATH`)

The browser revision must match `@playwright/test` in `package-lock.json` (1.63.0 at wave 0).
On every Playwright bump the owner repeats this; a mismatch makes the routed e2e job fail
(hosted then runs it) until re-provisioned.

```bash
# as root
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
npx -y playwright@1.63.0 install --with-deps chromium     # OS libs via apt + chromium
chown -R root:root /opt/ms-playwright && chmod -R a+rX,go-w /opt/ms-playwright
# check as the runner user: launches, and cannot write there
sudo -u ghrunner-web env PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
  npx -y playwright@1.63.0 --version
sudo -u ghrunner-web touch /opt/ms-playwright/x && echo 'WRONG: writable' || echo 'ok: read-only'
```

## 3. HOME and caches (nothing to install; check after the first start)

The unit points `HOME`, `XDG_CACHE_HOME`, `XDG_CONFIG_HOME` and `npm_config_cache` into
`/srv/ghrunner-web/runner/_work/{_home,_cache}`; `ExecStartPre` creates both. The job-started hook
empties `_home` before every job (no `.npmrc` / `.gitconfig` carried between jobs) and keeps
`_cache` (npm's cache is integrity-checked). Check: `ls -ld /srv/ghrunner-web/runner/_work/_home`
is owned by `ghrunner-web`.

## 4. resolver-allow: DNS resolver versus `IPAddressDeny`

The unit denies all LAN ranges. If the resolver the runner's processes talk to is ON the LAN,
every DNS lookup fails and every routed job fails (hosted then runs it). Add **only the resolver's
single address** as `IPAddressAllow=`, never a LAN range.

```bash
cat /etc/resolv.conf | grep ^nameserver
```

- `nameserver 127.0.0.53` (systemd-resolved stub) or any `127.x` / `::1`: loopback is allowed and
  the upstream query is made by `systemd-resolved` in ITS OWN unit, outside the runner's IP
  filter. **Nothing to add.** (`resolvectl status` shows the upstream; leave it alone.)
- `nameserver 192.168.x.y` / `10.x` / `172.16-31.x` (a LAN router): set
  `IPAddressAllow=<that one address>` in the unit (the commented line), then `daemon-reload`.
- A public resolver (`1.1.1.1`, `8.8.8.8`): not in a denied range, nothing to add.

Prove it under the same filter before the first job (as root):

```bash
systemd-run --wait --pipe --uid=ghrunner-web \
  -p IPAddressDeny="10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10 fc00::/7 fe80::/10" \
  -p IPAddressAllow=<resolver-if-LAN> \
  bash -c 'getent ahosts github.com | head -1 && getent ahosts registry.npmjs.org | head -1'
# and the LAN must stay closed (expect a failure / timeout):
systemd-run --wait --pipe --uid=ghrunner-web \
  -p IPAddressDeny="10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10 fc00::/7 fe80::/10" \
  timeout 5 bash -c 'echo > /dev/tcp/<router-ip>/80' && echo 'WRONG: LAN reachable' || echo 'ok: LAN closed'
```

## 5. Memory

Leave `MemoryMax=4G` until the owner has read `free -m` on the Acer and wave 1 has measured the
routed job's peak; see `docs/handover/ci-offload-wave0.md`, "Memory".
