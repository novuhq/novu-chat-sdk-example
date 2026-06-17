import { createMemoryState } from '@chat-adapter/state-memory';
import { createNovuAdapter, getNovuContext } from '@novu/chat-sdk-adapter';
import { type Adapter, Chat, type StateAdapter } from 'chat';

import { resolveBridgeConfig } from '@/lib/novu/bridge-config';
import { buildDemoCard } from '@/lib/novu/demo-card';

export function registerHandlers(chat: Chat): void {
  chat.onNewMention(async (thread, message) => {
    if (message.text.trim().toLowerCase() === 'card') {
      await thread.post(buildDemoCard(getNovuContext(thread).platform));

      return;
    }

    if (thread.isDM) {
      await thread.post(`Hello! (DM) You said: "${message.text}".`);

      return;
    }

    await thread.post(`Hi! You said: "${message.text}". I'll remember this conversation.`);
  });

  chat.onSubscribedMessage(async (thread, message) => {
    const novu = getNovuContext(thread);

    if (message.text.trim().toLowerCase() === 'resolve') {
      await novu.resolve('Resolved from the example agent.');
      await thread.post('Marked this conversation as resolved.');

      return;
    }

    if (message.text.trim().toLowerCase() === 'card') {
      await thread.post(buildDemoCard(novu.platform));

      return;
    }

    if (message.text.trim().toLowerCase() === 'whoami') {
      const subscriber = await novu.getSubscriber();
      const user = await thread.adapter.getUser?.(message.author.userId);
      await thread.post(
        `subscriber: ${subscriber?.subscriberId ?? 'unknown'} (${subscriber?.email ?? 'no email'})` +
          (user ? ` · userInfo: ${user.fullName}` : ''),
      );

      return;
    }

    await thread.post(`echo (${novu.platform}): ${message.text}`);
  });

  chat.onAction(async (event) => {
    await event.thread?.post(
      `You clicked **${event.actionId}**${event.value ? ` (value: ${event.value})` : ''}.`,
    );
  });

  chat.onReaction(async (event) => {
    if (!event.added) return;

    await event.thread.post(`Thanks for the ${event.emoji} reaction!`);
  });
}

let agentPromise: Promise<{ chat: Chat; novu: Adapter }> | null = null;

export function resetNovuAgent(): void {
  agentPromise = null;
}

export function getNovuAgent(): Promise<{ chat: Chat; novu: Adapter }> {
  if (!agentPromise) {
    agentPromise = (async () => {
      const config = resolveBridgeConfig();
      if (!config) {
        throw new Error(
          'Bridge not configured. Set NOVU_SECRET_KEY and NOVU_AGENT_IDENTIFIER via .env.local or the setup UI.',
        );
      }

      const novu = createNovuAdapter({
        apiKey: config.secretKey,
        agentIdentifier: config.agentIdentifier,
        bridgeSecret: config.secretKey,
        apiBaseUrl: config.apiBaseUrl,
        ...(config.bridgeUrl ? { bridgeUrl: config.bridgeUrl } : {}),
      });

      const chat = new Chat({
        userName: 'novu-example-agent',
        adapters: { novu: novu as unknown as Adapter },
        state: createMemoryState() as unknown as StateAdapter,
      });

      registerHandlers(chat);
      await chat.initialize();

      return { chat, novu: novu as unknown as Adapter };
    })();
  }

  return agentPromise;
}
