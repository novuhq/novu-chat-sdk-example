import { normalizeBridgeUrl, type ResolvedBridgeConfig } from '@/lib/novu/bridge-config';

export type BridgeSyncMode = 'dev' | 'production';

export interface SyncBridgeResult {
  ok: true;
  mode: BridgeSyncMode;
  agentIdentifier: string;
  bridgeUrl: string;
  novuEndpoint: string;
}

/**
 * Register the agent bridge URL with Novu — same API the `npx novu dev` CLI uses.
 *
 * Dev/local: PUT /v1/agents/:id/bridge { devBridgeUrl, devBridgeActive: true }
 * Production: PUT /v1/agents/:id/bridge { bridgeUrl }
 */
export async function syncAgentBridgeToNovu(
  config: ResolvedBridgeConfig,
  bridgeUrlInput: string,
): Promise<SyncBridgeResult> {
  const bridgeUrl = normalizeBridgeUrl(bridgeUrlInput);
  if (!bridgeUrl) {
    throw new Error('A public bridge URL is required');
  }

  const base = config.apiBaseUrl.replace(/\/$/, '');
  const novuEndpoint = `${base}/v1/agents/${encodeURIComponent(config.agentIdentifier)}/bridge`;
  const mode: BridgeSyncMode = process.env.NODE_ENV === 'production' ? 'production' : 'dev';
  const body =
    mode === 'dev'
      ? { devBridgeUrl: bridgeUrl, devBridgeActive: true }
      : { bridgeUrl };

  const response = await fetch(novuEndpoint, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `ApiKey ${config.secretKey}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 403) {
    throw new Error(
      'Novu rejected dev bridge activation (403). Dev bridges cannot be activated on production environments.',
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Novu bridge sync failed (${response.status}): ${detail}`);
  }

  return {
    ok: true,
    mode,
    agentIdentifier: config.agentIdentifier,
    bridgeUrl,
    novuEndpoint,
  };
}
