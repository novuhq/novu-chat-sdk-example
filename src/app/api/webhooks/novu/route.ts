import { getBridgeConfigStatus } from '@/lib/novu/bridge-config';
import { getNovuAgent } from '@/lib/novu/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_PATH = '/api/webhooks/novu';

export async function POST(req: Request): Promise<Response> {
  try {
    const { novu } = await getNovuAgent();

    return await novu.handleWebhook(req);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Bridge error' }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  const status = getBridgeConfigStatus();

  return Response.json({
    ok: true,
    configured: status.configured,
    sources: status.sources,
    hasSecretKey: status.hasSecretKey,
    uiConfigEnabled: status.uiConfigEnabled,
    env: status.env,
    ui: status.ui,
    agentIdentifier: status.agentIdentifier,
    bridgeUrl: status.bridgeUrl,
    webhookPath: WEBHOOK_PATH,
    hint: status.configured
      ? 'Point your Novu agent bridge URL at POST /api/webhooks/novu (use a public tunnel for local dev)'
      : 'Set credentials in .env.local or use the setup form below, then restart is not required for UI saves',
  });
}
