import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = join(process.cwd(), '.novu-bridge.local.json');
const WEBHOOK_PATH = '/api/webhooks/novu';

export function normalizeBridgeUrl(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith(WEBHOOK_PATH)) return trimmed;

  return `${trimmed}${WEBHOOK_PATH}`;
}

function bridgeUrlBase(url: string): string {
  return url.replace(WEBHOOK_PATH, '').replace(/\/$/, '');
}

export type ConfigSource = 'env' | 'ui';

export interface UiBridgeConfig {
  secretKey?: string;
  agentIdentifier?: string;
  apiBaseUrl?: string;
  bridgeUrl?: string;
}

export interface ResolvedBridgeConfig {
  secretKey: string;
  agentIdentifier: string;
  apiBaseUrl: string;
  bridgeUrl?: string;
  sources: {
    secretKey: ConfigSource;
    agentIdentifier: ConfigSource;
    apiBaseUrl: ConfigSource;
    bridgeUrl: ConfigSource | null;
  };
}

export interface BridgeConfigStatus {
  configured: boolean;
  sources: ResolvedBridgeConfig['sources'] | null;
  agentIdentifier: string | null;
  apiBaseUrl: string;
  bridgeUrl: string | null;
  hasSecretKey: boolean;
  uiConfigEnabled: boolean;
  env: {
    NOVU_SECRET_KEY: boolean;
    NOVU_AGENT_IDENTIFIER: boolean;
    NOVU_BRIDGE_URL: boolean;
    NOVU_API_BASE_URL: boolean;
  };
  ui: {
    NOVU_SECRET_KEY: boolean;
    NOVU_AGENT_IDENTIFIER: boolean;
    NOVU_BRIDGE_URL: boolean;
    NOVU_API_BASE_URL: boolean;
  };
}

export function isUiConfigEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_UI_BRIDGE_CONFIG === 'true';
}

function readUiConfig(): UiBridgeConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;

  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as UiBridgeConfig;
  } catch {
    return null;
  }
}

function pickField(
  envValue: string | undefined,
  uiValue: string | undefined,
): { value: string | undefined; source: ConfigSource | null } {
  if (envValue) return { value: envValue, source: 'env' };
  if (uiValue) return { value: uiValue, source: 'ui' };

  return { value: undefined, source: null };
}

export function resolveBridgeConfig(): ResolvedBridgeConfig | null {
  const ui = readUiConfig();

  const secretKey = pickField(process.env.NOVU_SECRET_KEY, ui?.secretKey);
  const agentIdentifier = pickField(process.env.NOVU_AGENT_IDENTIFIER, ui?.agentIdentifier);
  const apiBaseUrl = pickField(
    process.env.NOVU_API_BASE_URL,
    ui?.apiBaseUrl ?? 'https://api.novu.co',
  );
  const bridgeUrl = pickField(process.env.NOVU_BRIDGE_URL, ui?.bridgeUrl);

  if (!secretKey.value || !agentIdentifier.value) return null;

  return {
    secretKey: secretKey.value,
    agentIdentifier: agentIdentifier.value,
    apiBaseUrl: apiBaseUrl.value ?? 'https://api.novu.co',
    bridgeUrl: bridgeUrl.value,
    sources: {
      secretKey: secretKey.source!,
      agentIdentifier: agentIdentifier.source!,
      apiBaseUrl: apiBaseUrl.source ?? 'ui',
      bridgeUrl: bridgeUrl.source,
    },
  };
}

export function getBridgeConfigStatus(): BridgeConfigStatus {
  const ui = readUiConfig();
  const resolved = resolveBridgeConfig();

  return {
    configured: resolved !== null,
    sources: resolved?.sources ?? null,
    agentIdentifier: resolved?.agentIdentifier ?? null,
    apiBaseUrl: resolved?.apiBaseUrl ?? process.env.NOVU_API_BASE_URL ?? 'https://api.novu.co',
    bridgeUrl: resolved?.bridgeUrl ?? null,
    hasSecretKey: Boolean(process.env.NOVU_SECRET_KEY || ui?.secretKey),
    uiConfigEnabled: isUiConfigEnabled(),
    env: {
      NOVU_SECRET_KEY: Boolean(process.env.NOVU_SECRET_KEY),
      NOVU_AGENT_IDENTIFIER: Boolean(process.env.NOVU_AGENT_IDENTIFIER),
      NOVU_BRIDGE_URL: Boolean(process.env.NOVU_BRIDGE_URL),
      NOVU_API_BASE_URL: Boolean(process.env.NOVU_API_BASE_URL),
    },
    ui: {
      NOVU_SECRET_KEY: Boolean(ui?.secretKey),
      NOVU_AGENT_IDENTIFIER: Boolean(ui?.agentIdentifier),
      NOVU_BRIDGE_URL: Boolean(ui?.bridgeUrl),
      NOVU_API_BASE_URL: Boolean(ui?.apiBaseUrl),
    },
  };
}

export function getUiConfigFormValues(): {
  agentIdentifier: string;
  apiBaseUrl: string;
  bridgeUrl: string;
  hasSecretKey: boolean;
} {
  const ui = readUiConfig();

  return {
    agentIdentifier: process.env.NOVU_AGENT_IDENTIFIER ?? ui?.agentIdentifier ?? '',
    apiBaseUrl:
      process.env.NOVU_API_BASE_URL ?? ui?.apiBaseUrl ?? 'https://api.novu.co',
    bridgeUrl: bridgeUrlBase(process.env.NOVU_BRIDGE_URL ?? ui?.bridgeUrl ?? ''),
    hasSecretKey: Boolean(process.env.NOVU_SECRET_KEY || ui?.secretKey),
  };
}

export function saveUiConfig(input: UiBridgeConfig): void {
  if (!isUiConfigEnabled()) {
    throw new Error('UI configuration is disabled in production');
  }

  const existing = readUiConfig() ?? {};
  const next: UiBridgeConfig = { ...existing };

  if (!process.env.NOVU_SECRET_KEY) {
    if (input.secretKey?.trim()) next.secretKey = input.secretKey.trim();
  }

  if (!process.env.NOVU_AGENT_IDENTIFIER) {
    if (input.agentIdentifier?.trim()) next.agentIdentifier = input.agentIdentifier.trim();
  }

  if (!process.env.NOVU_API_BASE_URL) {
    if (input.apiBaseUrl?.trim()) next.apiBaseUrl = input.apiBaseUrl.trim();
  }

  if (!process.env.NOVU_BRIDGE_URL) {
    if (input.bridgeUrl?.trim()) next.bridgeUrl = normalizeBridgeUrl(input.bridgeUrl);
  }

  const secretKey = process.env.NOVU_SECRET_KEY ?? next.secretKey;
  const agentIdentifier = process.env.NOVU_AGENT_IDENTIFIER ?? next.agentIdentifier;

  if (!secretKey || !agentIdentifier) {
    throw new Error('NOVU_SECRET_KEY and NOVU_AGENT_IDENTIFIER are required');
  }

  if (!process.env.NOVU_SECRET_KEY) next.secretKey = secretKey;
  if (!process.env.NOVU_AGENT_IDENTIFIER) next.agentIdentifier = agentIdentifier;

  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
}

export function clearUiConfig(): void {
  if (!isUiConfigEnabled()) {
    throw new Error('UI configuration is disabled in production');
  }

  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
  }
}
