# Run the monitors with Docker Compose

This setup replaces the ten Node processes on the Linux `crosschain` server with
ten services. They share one image built from the TypeScript sources, use the
existing `.env`, and connect to the existing MySQL database. The database stores
the sync cursors, bills and Meson queues, so container replacement preserves progress.

| Service | Existing command |
| --- | --- |
| `sync-wbtc` | `node sync/Sync.js sync 0x1f545487c62e5acfea45dcadd9c627361d1616d8 0` |
| `sync-dai` | `node sync/Sync.js sync 0x74eaE367d018A5F29be559752e4B67d01cc6b151 0` |
| `sync-usdt` | `node sync/Sync.js sync 0xfe97e85d13abd9c1c33384e796f10b73905637ce 0` |
| `sync-bnb` | `node sync/Sync.js sync 0x94bd7a37d2ce24cc597e158facaa8d601083ffec 0` |
| `sync-usdc` | `node sync/Sync.js sync 0x6963efed0ab40f6c3d7bda44a05dcf1437c44372 0` |
| `sync-eth` | `node sync/Sync.js sync 0xa47f43de2f9623acb395ca4905746496d2014d57 0` |
| `cfx-pool` | `node sync/CfxPoolMonitor.js` |
| `meson-fetcher` | `node sync/fetcher/runMeson.js` |
| `meson-monitor` | `node sync/fetcher/runMeson.js runMonitor` |
| `web` | `node web/WebApp.js` |

The token addresses, including their capitalization, match the original commands.
`Sync.ts` includes the address verbatim in the cursor key; changing its spelling
could start a separate cursor. The final `0` is the fallback only when that key is
absent, so retain the existing database.

## First migration

Install [Docker Engine with the Compose plugin](https://docs.docker.com/engine/install/)
on the Linux server, then check:

```sh
cd ~/crosschain
docker version
docker compose version
```

Keep the existing `.env`. For a new installation only, copy `.env.example` to
`.env` and replace its placeholders. Required settings are `DB_URL`, `E_SPACE_RPC`,
`ETH_RPC`, `ARBITRUM_ONE_RPC`, and `ETHER_SCAN_API_KEY`. Preserve the existing
notification tokens and optional settings. Single-quote values containing `$`
because Compose interpolates unquoted and double-quoted values. Use
`docker compose config --quiet` to validate without printing credentials.

The services use [host networking](https://docs.docker.com/engine/network/drivers/host/)
on Linux: `localhost` and `127.0.0.1` still refer to the server, including for
MySQL and a local proxy. The web service uses `WEB_PORT` (default `3003`) directly
on the host, with the same binding behavior as the existing process.

Build before stopping the existing processes. Only one service needs to be built
because all ten use the same image:

```sh
docker compose config --quiet
docker compose build web
```

List the old processes again; the PIDs in an earlier `ps` listing may have changed:

```sh
pgrep -af '^node (sync/Sync[.]js sync |sync/CfxPoolMonitor[.]js$|sync/fetcher/runMeson[.]js( runMonitor)?$|web/WebApp[.]js$)'
```

Stop the ten matching processes from the table with Ctrl+C in their terminals,
or `kill -INT PID` using each confirmed current PID. Wait for them to exit and
disable any old supervisor that would restart them. Then start Compose:

```sh
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=100 -f
```

Run one instance of each worker: overlapping old and new workers can write the
same database records and send duplicate alerts. The web process must also
release its port before its container can start.

## Daily commands

```sh
# Status and recent logs
docker compose ps
docker compose logs --tail=100 -f sync-eth
docker compose logs --tail=100 -f meson-fetcher meson-monitor

# Restart, pause, or resume one worker
docker compose restart sync-eth
docker compose stop sync-eth
docker compose up -d --no-build sync-eth

# Stop or resume the whole stack
docker compose stop
docker compose up -d --no-build

# Apply an .env change (restart alone does not reload environment variables)
docker compose up -d --no-build --force-recreate

# Rebuild after pulling a code update
git pull --ff-only
docker compose build web
docker compose up -d --no-build
```

`restart: unless-stopped` restarts exiting processes and starts running services
again after a Docker daemon or host restart. It also restarts sync workers that
exit after a mint alert; use `docker compose stop SERVICE` to pause one while
investigating. Enable Docker at boot on a systemd server with
`sudo systemctl enable --now docker`.

Logs rotate at 10 MB with three files per service. The web health check requests
`/` on its configured port; it checks HTTP availability, not sync progress. Worker
progress remains visible in their logs and the existing `/sync-info` endpoint.

The image runs as the `node` user and includes compiled JavaScript. `.env`, local
dependencies, generated host JavaScript, and database files are excluded from the
build context. The Solidity compiler and a deployment private key are not needed.
Dependencies come from `yarn.lock`; native install scripts for the unused legacy
SQLite/Hardhat tooling are skipped. This image supports the existing MySQL setup
and uses the SDKs' JavaScript implementations. It does not include SQLite bindings.

To return to manual processes, run `docker compose down` first, compile with
`npm run compile`, and restart the commands in the table with the same `.env`.
The external database is unaffected by `docker compose down`.
