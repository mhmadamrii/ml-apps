# Deploying adano + fraudless with Podman

```
                 ┌──────────── gateway (Caddy) ────────────┐
 adano.<domain>  │ /api/* -> adano-api:8000   else adano-web:3000
 fraudless.<dom> │ /api/* -> fraudless-api:8001 else fraudless-web:3000
                 └───────────────────┬─────────────────────┘
        adano-api ──┐                │            ┌── fraudless-api (+ model volume, read-only)
                    └──────── db (postgres 16: databases adano, fraudless; one role each)
```

Only the gateway publishes ports. APIs, web apps and Postgres live on the private compose network.

| Image | Recipe | Context |
| --- | --- | --- |
| `adano-web`, `fraudless-web` | `deploy/web.Containerfile` (`--build-arg APP=...`) | repo root |
| `adano-api` | `apps/adano-api/Containerfile` | `apps/adano-api` |
| `fraudless-api` | `apps/fraudless-api/Containerfile` | `apps/fraudless-api` |

## Run

```sh
pnpm train:fraudless                         # creates apps/fraudless-api/models/v1 (mounted, never baked in)
cp deploy/.env.example deploy/.env           # fill the three passwords: openssl rand -hex 16
podman compose -f deploy/compose.yaml --env-file deploy/.env up -d --build

curl -H 'Host: adano.localhost'     localhost:8080/api/health
curl -H 'Host: fraudless.localhost' localhost:8080/api/health
# browsers resolve *.localhost on their own: http://adano.localhost:8080  http://fraudless.localhost:8080
```

Postgres init (roles, databases) runs only on an empty `pgdata` volume. Changing a password later means altering the role in Postgres, not just the `.env`.

## Going to a real host

1. Point DNS for both names at the host; set `ADANO_SITE`, `FRAUDLESS_SITE` (no `http://`), `HTTP_PORT=80`, `HTTPS_PORT=443`. Caddy then provisions TLS. Rootless Podman needs `net.ipv4.ip_unprivileged_port_start=80` (or a root/privileged setup) to bind 80/443.
2. Size the machine for the heaviest container: `adano-api` loads PyTorch + a 470 MB embedding model (about 1 GB RAM). Allow roughly 3 GB total.
3. Back up the `pgdata` volume.

## Design notes and known gaps

- **Reproducible Python images.** `requirements.lock` in each API pins the exact versions the tests ran with. `fraudless-api` also refuses to start if the artifact was trained under a different scikit-learn (pickles are version-bound). Regenerate a lock after changing `requirements.txt`: `uv pip freeze --python .venv/bin/python | grep -v -E '^(pytest|pluggy|iniconfig|pyarrow|httpx2?)=='` and prepend the comment line.
- **CPU-only torch** is installed from the PyTorch CPU index before the lock (the default Linux wheel pulls ~2 GB of CUDA libraries). The embedding model is baked into the image; the container runs with `HF_HUB_OFFLINE=1`.
- **Non-root, no secrets in images.** Config arrives as environment variables; the model is a read-only mount.
- **Same-origin API.** Browsers only talk to the gateway, so adano-api sets no CORS headers by default (`ADANO_CORS_ORIGINS` opts in).
- **Not yet done:** there is no authentication or rate limiting anywhere (fraudless Phase 4); tables are created at API startup (`create_all`), so run a single replica per API until real migrations exist; no CI builds or image registry; images are not scanned or signed.
