import { resolveBridgeConfig } from '@/lib/novu/bridge-config';
import { syncAgentBridgeToNovu } from '@/lib/novu/register-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const config = resolveBridgeConfig();
  if (!config) {
    return Response.json(
      { error: 'Bridge not configured. Set NOVU_SECRET_KEY and NOVU_AGENT_IDENTIFIER first.' },
      { status: 400 },
    );
  }

  let bridgeUrl = config.bridgeUrl;
  try {
    const body = (await req.json().catch(() => ({}))) as { bridgeUrl?: string };
    if (body.bridgeUrl?.trim()) {
      bridgeUrl = body.bridgeUrl.trim();
    }
  } catch {
    // use resolved config bridgeUrl
  }

  if (!bridgeUrl) {
    return Response.json({ error: 'Set a public tunnel URL before syncing to Novu.' }, { status: 400 });
  }

  try {
    const result = await syncAgentBridgeToNovu(config, bridgeUrl);

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to sync bridge to Novu' },
      { status: 502 },
    );
  }
}
