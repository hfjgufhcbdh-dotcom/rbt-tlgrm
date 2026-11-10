# Telegram bot (Node.js)

This repository is a pnpm workspace. The Telegram bot and its HTTP API run from `artifacts/api-server`; the repository-root `index.js` is the Node.js entry point for the built server.

## Requirements

- Node.js 22.12 or newer.
- pnpm 10 (the repository includes `pnpm-lock.yaml` and `pnpm-workspace.yaml`).
- A PostgreSQL database.

## Botkeep / production deployment

1. Import the GitHub repository `hfjgufhcbdh-dotcom/rbt-tlgrm` and deploy the `main` branch (or your chosen branch).
2. Install dependencies from the repository root using `pnpm install --frozen-lockfile`.
3. Set the start command to `pnpm start`. The command builds the API server, then runs the Node.js process. For platforms with a separate build step, use `pnpm build` as the build command and `node --enable-source-maps index.js` as the start command.
4. Configure the environment variables listed below in Botkeep. Do not commit a `.env` file or put credentials in source code.
5. Provision PostgreSQL and apply the database schema before starting the bot. From the repository root, run `pnpm --filter @workspace/db push` with `DATABASE_URL` set. Take a database backup before applying schema changes to an existing database.

The HTTP service binds to `0.0.0.0` and uses Botkeep's `PORT` when provided; it falls back to port `8080`. The health endpoint is `/api/healthz`. No Replit keep-alive request is needed.

## Required environment variables

- `TELEGRAM_BOT_TOKEN` — Telegram bot token.
- `DATABASE_URL` — PostgreSQL connection URL, including credentials, provided as a secret.

Optional: `NODE_ENV=production` and `LOG_LEVEL=info`.

A sample environment file is available at `.env.example`; it contains placeholders only. Configure the real values through Botkeep's secret/environment-variable settings.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm start
```

`pnpm start` requires valid `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, and a reachable PostgreSQL database. The bot's Telegram polling and live data integrations cannot be verified without those external services.
