# Novu Chat SDK Example

A clean Next.js boilerplate showing how to build a multi-channel chat bot with [Chat SDK](https://chat-sdk.dev) and [`@novu/chat-sdk-adapter`](https://github.com/novuhq/novu/pull/11593). One handler set serves Slack, WhatsApp, Microsoft Teams, Telegram, and Email — Novu normalizes inbound events and routes replies back to the originating channel.

## What this demonstrates

- **Live bridge** at `POST /api/webhooks/novu` — Novu POSTs signed `AgentBridgeRequest` webhooks here
- **Setup UI** at `/` — step-by-step instructions to connect your Novu agent to a local or deployed instance
- **Handler examples** — echo, interactive cards, `getNovuContext()` (`whoami`, `resolve`), `onAction`, `onReaction`

```
End-user channels → Novu (normalize) → your Next.js app (@novu/chat-sdk-adapter) → Novu reply API → channel
```

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for setup instructions and bridge status.

### Dependencies

This example installs the published adapter and Chat SDK straight from npm. The adapter tracks the `latest` dist-tag so a fresh install always pulls the newest release:

```json
"@novu/chat-sdk-adapter": "latest",
"chat": "4.30.0",
"@chat-adapter/state-memory": "4.30.0"
```

Run `pnpm update @novu/chat-sdk-adapter --latest` to move the lockfile to the newest published version.

## Connect to Novu

Configure credentials using **either** environment variables **or** the setup form on the home page (dev only). Environment variables always take precedence when both are set.

### Option A — Environment variables

1. Copy `.env.example` to `.env.local` and set:

   ```env
   NOVU_SECRET_KEY=your_secret_key
   NOVU_AGENT_IDENTIFIER=your-agent-id
   ```

2. Restart the dev server after changing env vars.

### Option B — Setup UI (local dev)

1. Run `pnpm dev` and open [http://localhost:3000](http://localhost:3000)
2. Fill in the **Bridge configuration** form and click **Save configuration**
3. Values are stored in `.novu-bridge.local.json` (gitignored) and apply immediately — no restart needed

UI configuration is disabled in production unless `ALLOW_UI_BRIDGE_CONFIG=true`.

### Finish connecting

1. Expose localhost with a tunnel:

   ```bash
   ngrok http 3000
   ```

2. Paste your ngrok URL in the setup UI and click **Sync to Novu** — or call the API directly:

   ```
   PUT /v1/agents/:agentIdentifier/bridge
   Authorization: ApiKey <NOVU_SECRET_KEY>

   # local dev (same as npx novu dev)
   { "devBridgeUrl": "https://YOUR_TUNNEL/api/webhooks/novu", "devBridgeActive": true }

   # production deploy
   { "bridgeUrl": "https://your-app.vercel.app/api/webhooks/novu" }
   ```

   The example app wraps this as `POST /api/webhooks/novu/sync`.

3. Send a message on any connected channel and confirm the bot replies.

Check bridge status: `GET /api/webhooks/novu` or use the status panel on the home page.

### Bot commands

| Message | Behavior |
|---|---|
| *(any text)* | Echo with platform name |
| `card` | Post an interactive Chat SDK card |
| `whoami` | Show subscriber + user info |
| `resolve` | Resolve the conversation in Novu |

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnovuhq%2Fnovu-chat-sdk-example)

1. Deploy this repo to Vercel
2. Set environment variables:
   - `NOVU_SECRET_KEY`
   - `NOVU_AGENT_IDENTIFIER`
   - `NOVU_BRIDGE_URL` = `https://your-app.vercel.app/api/webhooks/novu`
   - `NOVU_API_BASE_URL` (optional, for EU/dev cloud)
3. Point your Novu agent bridge URL at the same public path
4. Webhook routes use the **Node.js runtime** (`runtime = 'nodejs'`) for HMAC verification — configured automatically

## Project structure

```
src/
  lib/novu/
    agent.ts          # Chat bot handlers + getNovuAgent() singleton
    demo-card.ts      # Interactive card builder
  app/
    page.tsx          # Setup guide + bridge status
    api/webhooks/novu/
      route.ts        # Live bridge (POST/GET)
      config/route.ts # Save UI/env config
      sync/route.ts   # Sync bridge URL to Novu API
scripts/
  setup-adapter.mjs   # Clones & builds @novu/chat-sdk-adapter on install
```

## Handler routing (recommended pattern)

Do **not** register `onDirectMessage`. Use:

- `onNewMention` for the first message (`thread.isDM` distinguishes DMs)
- `onSubscribedMessage` for all follow-ups

The Novu adapter pre-subscribes when `messageCount > 1`.

## Learn more

- [Novu Chat SDK adapter PR](https://github.com/novuhq/novu/pull/11593)
- [Chat SDK docs](https://chat-sdk.dev)
- [Novu agents](https://docs.novu.co)
