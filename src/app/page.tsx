'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, ExternalLinkIcon, PencilIcon, RefreshCwIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ConfigSource = 'env' | 'ui';

interface BridgeStatus {
  configured: boolean;
  sources: Record<string, ConfigSource | null> | null;
  hasSecretKey: boolean;
  uiConfigEnabled: boolean;
  agentIdentifier: string | null;
  bridgeUrl: string | null;
}

interface ConfigFormValues {
  agentIdentifier: string;
  apiBaseUrl: string;
  bridgeUrl: string;
  hasSecretKey: boolean;
}

interface ConfigApiResponse {
  enabled: boolean;
  form: ConfigFormValues;
  locked: {
    secretKey: boolean;
    agentIdentifier: boolean;
    apiBaseUrl: boolean;
    bridgeUrl: boolean;
  };
}

interface FormState {
  secretKey: string;
  agentIdentifier: string;
  apiBaseUrl: string;
  bridgeBase: string;
  hasSecretKey: boolean;
}

interface ActionMessage {
  type: 'success' | 'error';
  text: string;
}

const WEBHOOK_PATH = '/api/webhooks/novu';
const NOVU_DASHBOARD_URL = 'https://dashboard.novu.co';

const BOT_COMMANDS = [
  { command: 'card', behavior: 'Posts an interactive Chat SDK card' },
  { command: 'whoami', behavior: 'Returns subscriber + user info via getNovuContext()' },
  { command: 'resolve', behavior: 'Resolves the conversation in Novu' },
  { command: 'anything else', behavior: 'Echoes your message back with the channel name' },
] as const;

type StepStatus = 'done' | 'active' | 'pending';

function StepDot({ status, index }: { status: StepStatus; index: number }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors',
        status === 'done' && 'border-transparent bg-primary text-primary-foreground',
        status === 'active' && 'border-primary bg-background text-foreground ring-4 ring-primary/10',
        status === 'pending' && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {status === 'done' ? <CheckIcon className="size-4" /> : index + 1}
    </span>
  );
}

function Step({
  index,
  status,
  title,
  description,
  isLast,
  children,
}: {
  index: number;
  status: StepStatus;
  title: string;
  description?: string;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className={cn('relative pl-12', !isLast && 'pb-6')}>
      <span className="absolute left-0 top-0">
        <StepDot status={status} index={index} />
      </span>
      {!isLast && <span className="absolute bottom-2 left-4 top-9 w-px -translate-x-1/2 bg-border" />}
      <div className="space-y-3 pt-1">
        <div className="space-y-0.5">
          <h3 className={cn('font-medium leading-none', status === 'pending' && 'text-muted-foreground')}>
            {title}
          </h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </li>
  );
}

function SourceBadge({ source }: { source?: ConfigSource | null }) {
  if (!source) return null;

  return (
    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
      {source}
    </Badge>
  );
}

function CopyField({
  value,
  copied,
  onCopy,
  mono = true,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className={cn('text-sm', mono && 'font-mono')} />
      <Button variant="outline" size="icon" onClick={onCopy} aria-label="Copy">
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </Button>
    </div>
  );
}

export default function HomePage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [config, setConfig] = useState<ConfigApiResponse | null>(null);
  const [form, setForm] = useState<FormState>({
    secretKey: '',
    agentIdentifier: '',
    apiBaseUrl: 'https://api.novu.co',
    bridgeBase: '',
    hasSecretKey: false,
  });

  const [loading, setLoading] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingCreds, setEditingCreds] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [credsMessage, setCredsMessage] = useState<ActionMessage | null>(null);
  const [syncMessage, setSyncMessage] = useState<ActionMessage | null>(null);
  const [synced, setSynced] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const bridgeBase = form.bridgeBase.replace(WEBHOOK_PATH, '').replace(/\/$/, '');
  const publicBridgeUrl = bridgeBase ? `${bridgeBase}${WEBHOOK_PATH}` : '';
  const credsDone = Boolean(status?.configured);
  const locked = config?.locked;
  const canEditConfig = status?.uiConfigEnabled ?? false;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch('/api/webhooks/novu'),
        fetch('/api/webhooks/novu/config'),
      ]);
      const statusData = (await statusRes.json()) as BridgeStatus;
      setStatus(statusData);

      if (configRes.ok) {
        const configData = (await configRes.json()) as ConfigApiResponse;
        setConfig(configData);
        setForm((prev) => ({
          ...prev,
          agentIdentifier: configData.form.agentIdentifier,
          apiBaseUrl: configData.form.apiBaseUrl,
          bridgeBase: configData.form.bridgeUrl,
          hasSecretKey: configData.form.hasSecretKey,
        }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function copy(text: string, key: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function saveCreds() {
    setSavingCreds(true);
    setCredsMessage(null);

    try {
      const res = await fetch('/api/webhooks/novu/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          secretKey: form.secretKey || undefined,
          agentIdentifier: form.agentIdentifier,
          apiBaseUrl: form.apiBaseUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setCredsMessage({ type: 'error', text: data.error ?? 'Failed to save credentials.' });
        return;
      }

      setForm((prev) => ({ ...prev, secretKey: '', hasSecretKey: true }));
      setEditingCreds(false);
      await loadStatus();
    } finally {
      setSavingCreds(false);
    }
  }

  async function syncBridge() {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch('/api/webhooks/novu/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bridgeUrl: publicBridgeUrl }),
      });
      const data = (await res.json()) as {
        error?: string;
        sync?: { mode: string; bridgeUrl: string };
        syncError?: string;
      };

      if (!res.ok) {
        setSyncMessage({ type: 'error', text: data.error ?? 'Failed to sync.' });
        return;
      }

      if (data.sync) {
        setSynced(true);
        setSyncMessage({
          type: 'success',
          text: `Registered with Novu as the ${data.sync.mode} bridge.`,
        });
      } else if (data.syncError) {
        setSyncMessage({ type: 'error', text: data.syncError });
      }

      await loadStatus();
    } finally {
      setSyncing(false);
    }
  }

  const step1Status: StepStatus = credsDone && !editingCreds ? 'done' : 'active';
  const step2Status: StepStatus = !credsDone ? 'pending' : synced ? 'done' : 'active';
  const step3Status: StepStatus = synced ? 'active' : 'pending';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-14">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Novu Chat SDK bridge</h1>
          <p className="text-sm text-muted-foreground">
            Connect a Novu agent to this app and reply across every channel from one set of handlers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={credsDone ? 'default' : 'secondary'} className="whitespace-nowrap">
            {credsDone ? 'Bridge ready' : 'Not configured'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void loadStatus()}
            disabled={loading}
            aria-label="Refresh status"
          >
            <RefreshCwIcon className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      <ol className="space-y-0">
        <Step
          index={0}
          status={step1Status}
          title="Connect your Novu agent"
          description="Authenticate with your environment secret key and agent identifier."
        >
          {step1Status === 'done' ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{status?.agentIdentifier}</span>
                  <SourceBadge source={status?.sources?.agentIdentifier} />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Secret key configured</span>
                  <SourceBadge source={status?.sources?.secretKey} />
                </div>
              </div>
              {canEditConfig && (
                <Button variant="ghost" size="sm" onClick={() => setEditingCreds(true)}>
                  <PencilIcon className="size-3.5" />
                  Edit
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border bg-card p-4">
              {!canEditConfig && (
                <Alert>
                  <AlertDescription>
                    UI editing is disabled. Set credentials via environment variables, or set{' '}
                    <code className="rounded bg-muted px-1">ALLOW_UI_BRIDGE_CONFIG=true</code> in dev.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="secretKey">Secret key</Label>
                  {locked?.secretKey && <Badge variant="secondary">from env</Badge>}
                </div>
                <Input
                  id="secretKey"
                  type="password"
                  placeholder={form.hasSecretKey ? '•••••••• saved — leave blank to keep' : 'sk_...'}
                  value={form.secretKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, secretKey: e.target.value }))}
                  disabled={!canEditConfig || locked?.secretKey}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="agentId">Agent identifier</Label>
                  {locked?.agentIdentifier && <Badge variant="secondary">from env</Badge>}
                </div>
                <Input
                  id="agentId"
                  placeholder="support-agent"
                  value={form.agentIdentifier}
                  onChange={(e) => setForm((prev) => ({ ...prev, agentIdentifier: e.target.value }))}
                  disabled={!canEditConfig || locked?.agentIdentifier}
                  className="font-mono text-sm"
                />
              </div>

              {showAdvanced && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="apiBase">API base URL</Label>
                    {locked?.apiBaseUrl && <Badge variant="secondary">from env</Badge>}
                  </div>
                  <Input
                    id="apiBase"
                    placeholder="https://api.novu.co"
                    value={form.apiBaseUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }))}
                    disabled={!canEditConfig || locked?.apiBaseUrl}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Use https://eu.api.novu.co for the EU region.</p>
                </div>
              )}

              {credsMessage && (
                <Alert variant={credsMessage.type === 'error' ? 'destructive' : 'default'}>
                  <AlertDescription>{credsMessage.text}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button onClick={() => void saveCreds()} disabled={!canEditConfig || savingCreds}>
                    {savingCreds ? 'Saving…' : 'Save & continue'}
                  </Button>
                  {credsDone && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingCreds(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {showAdvanced ? 'Hide advanced' : 'Advanced'}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Find these in your{' '}
                <a
                  href={NOVU_DASHBOARD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 underline underline-offset-4"
                >
                  Novu dashboard
                  <ExternalLinkIcon className="size-3" />
                </a>{' '}
                under Settings and Agents.
              </p>
            </div>
          )}
        </Step>

        <Step
          index={1}
          status={step2Status}
          title="Expose & register your bridge"
          description="Give Novu a public URL it can deliver inbound messages to."
        >
          {step2Status === 'pending' ? (
            <p className="text-sm text-muted-foreground">Complete step 1 to continue.</p>
          ) : (
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="space-y-2">
                <Label>1. Start a tunnel to your dev server</Label>
                <CopyField
                  value="ngrok http 3000"
                  copied={copied === 'ngrok'}
                  onCopy={() => void copy('ngrok http 3000', 'ngrok')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tunnel">2. Paste your public URL</Label>
                  {locked?.bridgeUrl && <Badge variant="secondary">from env</Badge>}
                </div>
                <Input
                  id="tunnel"
                  placeholder="https://abc123.ngrok-free.app"
                  value={bridgeBase}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, bridgeBase: e.target.value.trim() }));
                    setSynced(false);
                  }}
                  disabled={locked?.bridgeUrl}
                  className="font-mono text-sm"
                />
                {publicBridgeUrl && (
                  <p className="text-xs text-muted-foreground">
                    Bridge endpoint:{' '}
                    <code className="rounded bg-muted px-1">{publicBridgeUrl}</code>
                  </p>
                )}
              </div>

              {syncMessage && (
                <Alert variant={syncMessage.type === 'error' ? 'destructive' : 'default'}>
                  <AlertDescription>{syncMessage.text}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={() => void syncBridge()}
                  disabled={!publicBridgeUrl || syncing || Boolean(locked?.bridgeUrl)}
                >
                  {syncing ? 'Registering…' : '3. Register bridge with Novu'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Calls{' '}
                  <code className="rounded bg-muted px-1">PUT /v1/agents/:id/bridge</code> — the same API{' '}
                  <code className="rounded bg-muted px-1">npx novu dev</code> uses.
                  {locked?.bridgeUrl && ' This URL is pinned by NOVU_BRIDGE_URL and registered on boot.'}
                </p>
              </div>
            </div>
          )}
        </Step>

        <Step
          index={2}
          status={step3Status}
          title="Test your bot"
          description="Send a message in any channel connected to your agent."
          isLast
        >
          {step3Status === 'pending' ? (
            <p className="text-sm text-muted-foreground">Register your bridge to start testing.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                Try these commands
              </div>
              <div className="divide-y">
                {BOT_COMMANDS.map((row) => (
                  <div key={row.command} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <code className="rounded bg-muted px-2 py-0.5 text-sm">{row.command}</code>
                    <span className="text-right text-sm text-muted-foreground">{row.behavior}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Step>
      </ol>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-6 text-xs text-muted-foreground">
        <span>
          Webhook: <code className="rounded bg-muted px-1">POST {WEBHOOK_PATH}</code>
        </span>
        <a
          href="https://chat-sdk.dev"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Chat SDK docs
        </a>
        <a
          href="https://docs.novu.co"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Novu docs
        </a>
      </footer>
    </main>
  );
}
