import {
  clearUiConfig,
  getBridgeConfigStatus,
  getUiConfigFormValues,
  isUiConfigEnabled,
  normalizeBridgeUrl,
  resolveBridgeConfig,
  saveUiConfig,
} from '@/lib/novu/bridge-config';
import { resetNovuAgent } from '@/lib/novu/agent';
import { syncAgentBridgeToNovu } from '@/lib/novu/register-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (!isUiConfigEnabled()) {
    return Response.json({ enabled: false }, { status: 403 });
  }

  const status = getBridgeConfigStatus();
  const form = getUiConfigFormValues();

  return Response.json({
    enabled: true,
    form,
    locked: {
      secretKey: status.env.NOVU_SECRET_KEY,
      agentIdentifier: status.env.NOVU_AGENT_IDENTIFIER,
      apiBaseUrl: status.env.NOVU_API_BASE_URL,
      bridgeUrl: status.env.NOVU_BRIDGE_URL,
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!isUiConfigEnabled()) {
    return Response.json({ error: 'UI configuration is disabled in production' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      secretKey?: string;
      agentIdentifier?: string;
      apiBaseUrl?: string;
      bridgeUrl?: string;
    };

    saveUiConfig(body);
    resetNovuAgent();

    const status = getBridgeConfigStatus();
    let sync = null;

    const bridgeUrl = body.bridgeUrl ? normalizeBridgeUrl(body.bridgeUrl) : status.bridgeUrl;
    if (bridgeUrl) {
      const config = resolveBridgeConfig();
      if (config) {
        try {
          sync = await syncAgentBridgeToNovu(config, bridgeUrl);
        } catch (err) {
          return Response.json(
            {
              ok: true,
              status,
              syncError: err instanceof Error ? err.message : 'Failed to sync bridge to Novu',
            },
            { status: 200 },
          );
        }
      }
    }

    return Response.json({ ok: true, status, sync });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to save configuration' },
      { status: 400 },
    );
  }
}

export async function DELETE(): Promise<Response> {
  if (!isUiConfigEnabled()) {
    return Response.json({ error: 'UI configuration is disabled in production' }, { status: 403 });
  }

  clearUiConfig();
  resetNovuAgent();

  return Response.json({ ok: true, status: getBridgeConfigStatus() });
}
