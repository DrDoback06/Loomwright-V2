import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  addMessage,
  createThread,
  deleteThread,
  listMessages,
  listThreads,
  updateThread,
} from '@/db/repos/chat';
import { snapshotScene } from '@/db/repos/scenes';
import type { ChatContextRef, ChatMode, ChatThread, Scene } from '@/db/types';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META } from '@/domain/entity-types';
import { configuredEntityTypes } from '@/domain/entity-configs';
import { buildChatContext, describeContext } from '@/services/context/chat-context';
import { buildChatPrompt, chatSystemPrompt, CHAT_MODES, recentHistory } from '@/services/ai/prompts/chat';
import { completeDetailed } from '@/services/ai/providers';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import { tierForModel, TIER_BUDGET } from '@/services/ai/prompts';
import { parseDeltaReply } from '@/services/intelligence/digest';
import { PrivacyConfirm } from '@/features/generate/PrivacyConfirm';
import { useIntelligenceStore } from '@/stores/intelligence';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

/**
 * A conversation about the book, with the book attached.
 *
 * The difference from a chat window in another tab is the chips: what
 * travels is explicit, removable, and identical to what a beat would send,
 * because it comes from the same assembler. And the two buttons under every
 * reply — **Insert into scene** and **Send to codex** — are what make it
 * part of the app rather than a place to read text. Send to codex routes
 * through `parseDeltaReply`, the same verification path a pasted reply
 * takes, so a model cannot make the app write anything the offline engine
 * would not have written on its own.
 *
 * With no provider it is not disabled: it copies the whole conversation as
 * a prompt and takes the reply back. That is the standing promise — offline
 * smarts are free forever, AI enriches — and it is the answer to the
 * complaint novelcrafter's own users make most.
 */
export function ChatDock({
  projectId,
  scene,
  onClose,
  onInsert,
}: {
  projectId: string;
  scene: Scene | null;
  onClose: () => void;
  /** Insert prose at the caret. Snapshotting first is this component's
   * job, not the caller's — it is the AI write, so it owns the undo. */
  onInsert: (prose: string) => void;
}) {
  // Deliberately NO default value: `useLiveQuery` returns `undefined`
  // until the first read resolves, and an empty-array default is
  // indistinguishable from "this project genuinely has no threads" — which
  // made every reload create another empty thread and lose the one the
  // author had been using.
  const threads = useLiveQuery(() => listThreads(projectId), [projectId]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rows = threads ?? [];
  const active = rows.find((t) => t.id === activeId) ?? rows[0] ?? null;
  const messages = useLiveQuery(
    () => (active ? listMessages(active.id) : Promise.resolve([])),
    [active?.id],
    []
  );

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [pasted, setPasted] = useState('');
  const [picking, setPicking] = useState(false);
  const stageDelta = useIntelligenceStore((s) => s.stage);
  const setRoute = useUiStore((s) => s.setRoute);

  useEffect(() => {
    void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);

  const entities = useLiveQuery(
    async () =>
      (await db.entities.where('projectId').equals(projectId).toArray())
        .filter((e) => e.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 200),
    [projectId],
    []
  );

  /** A new thread starts attached to the scene the author is in, because
   * that is what they are almost certainly asking about. */
  const startThread = async () => {
    const context: ChatContextRef[] = scene
      ? [{ kind: 'scene', id: scene.id, label: `Scene: ${scene.title || 'Untitled'}` }]
      : [];
    const thread = await createThread(projectId, { sceneId: scene?.id ?? null, context });
    setActiveId(thread.id);
  };

  // The dock is useless with no thread, and "press New thread first" is a
  // step nobody wants. One is made on first open.
  useEffect(() => {
    if (threads && threads.length === 0) void startThread();
  }, [threads]);

  const available = useMemo(
    () => ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t)),
    []
  );

  const attach = (ref: ChatContextRef) => {
    if (!active) return;
    if (active.context.some((c) => c.kind === ref.kind && c.id === ref.id)) return;
    void updateThread(active.id, { context: [...active.context, ref] });
    setPicking(false);
  };

  const detach = (ref: ChatContextRef) => {
    if (!active) return;
    void updateThread(active.id, {
      context: active.context.filter((c) => !(c.kind === ref.kind && c.id === ref.id)),
    });
  };

  const assemble = async (thread: ChatThread, message: string) => {
    const config = await resolveProvider(projectId);
    const tier = config ? tierForModel(config) : 'large';
    const context = await buildChatContext(projectId, thread.context, { tier });
    return {
      config,
      tier,
      system: chatSystemPrompt(thread.mode),
      prompt: buildChatPrompt({
        mode: thread.mode,
        context: context.text,
        history: recentHistory(messages, thread.memoryPairs),
        message,
      }),
      summary: describeContext(thread.context),
      trimmed: context.trimmed,
    };
  };

  const send = async () => {
    const thread = active;
    const text = input.trim();
    if (!thread || !text) return;
    setBusy(true);
    setConfirming(false);
    try {
      const { config, tier, system, prompt, summary, trimmed } = await assemble(thread, text);
      if (!config) {
        toast('No AI provider configured — use Copy conversation instead.', { kind: 'error' });
        return;
      }
      await addMessage(thread.id, 'user', text, { contextSummary: summary });
      setInput('');
      if (trimmed) {
        toast('The attached material was shortened to fit this model.', {});
      }
      const result = await completeDetailed(config, {
        system,
        prompt,
        temperature: 0.7,
        maxTokens: TIER_BUDGET[tier].maxTokens,
      });
      await addMessage(thread.id, 'assistant', result.text.trim(), {
        truncated: result.truncated,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That request did not go through.', {
        kind: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!active || !input.trim()) return;
    const settings = await getAiSettings(projectId);
    if (settings.privacy === 'ask') setConfirming(true);
    else void send();
  };

  /** The offline path, and it is the same conversation — not a reduced
   * one. Run it wherever you already have a model and bring the reply
   * back; the two buttons under it work identically. */
  const copyConversation = async () => {
    const thread = active;
    if (!thread || !input.trim()) {
      toast('Write your message first — it goes in the prompt.', {});
      return;
    }
    const { system, prompt } = await assemble(thread, input.trim());
    const whole = `${system}\n\n${prompt}`;
    setPromptText(whole);
    try {
      await navigator.clipboard.writeText(whole);
      toast('Conversation copied — paste the reply back below.', { kind: 'success' });
    } catch {
      toast('Select and copy the prompt below, then paste the reply back.', {});
    }
  };

  const takePasted = async () => {
    const thread = active;
    if (!thread || !pasted.trim()) return;
    const text = input.trim();
    if (text) {
      await addMessage(thread.id, 'user', text, { contextSummary: describeContext(thread.context) });
      setInput('');
    }
    await addMessage(thread.id, 'assistant', pasted.trim());
    setPasted('');
    setPromptText('');
  };

  const sendToCodex = async (text: string) => {
    const delta = await parseDeltaReply(projectId, text);
    if ('error' in delta || !delta.groups.length) {
      toast(
        'error' in delta
          ? delta.error
          : 'Nothing in that reply the engine could verify. Ask for JSON facts.',
        { kind: 'error' }
      );
      return;
    }
    stageDelta(delta);
    toast(`${delta.groups.length} change${delta.groups.length === 1 ? '' : 's'} to review.`, {
      kind: 'success',
      action: { label: 'Review', run: () => setRoute('review') },
    });
  };

  const insertInto = async (text: string) => {
    if (!scene) {
      toast('Open a scene to insert into.', {});
      return;
    }
    await snapshotScene(scene.id, 'pre-ai', 'Before a chat insertion');
    onInsert(text);
    toast('Inserted. The page before it is a save point in the Scene panel.', { kind: 'success' });
  };

  return (
    <aside className="lw-chatdock" aria-label="Chat" data-testid="chat-dock">
      <div className="lw-ctxrail__head">
        <strong>Chat</strong>
        <button type="button" className="lw-iconbtn" aria-label="Close chat" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="lw-chatdock__threads">
        <label className="lw-visually-hidden" htmlFor="chat-thread">
          Thread
        </label>
        <select
          id="chat-thread"
          className="lw-input lw-input--sm"
          value={active?.id ?? ''}
          onChange={(e) => setActiveId(e.target.value)}
        >
          {rows.map((thread) => (
            <option key={thread.id} value={thread.id}>
              {thread.title}
            </option>
          ))}
        </select>
        <button type="button" className="lw-btn lw-btn--sm" onClick={() => void startThread()}>
          New thread
        </button>
        {active && rows.length > 1 ? (
          <button
            type="button"
            className="lw-btn lw-btn--sm lw-btn--ghost"
            onClick={() => {
              void deleteThread(active.id).then(() => setActiveId(null));
            }}
          >
            Delete
          </button>
        ) : null}
      </div>

      {active ? (
        <>
          <div className="lw-chatdock__modes" role="group" aria-label="Chat mode">
            {CHAT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={mode.id === active.mode ? 'lw-pill lw-pill--active' : 'lw-pill'}
                aria-pressed={mode.id === active.mode}
                title={mode.note}
                onClick={() => void updateThread(active.id, { mode: mode.id as ChatMode })}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="lw-fieldnote">
            {CHAT_MODES.find((m) => m.id === active.mode)?.note}
          </p>

          <div className="lw-chips" aria-label="Attached to this thread">
            <div className="lw-chips__row">
              {active.context.map((ref) => (
                <span key={`${ref.kind}:${ref.id}`} className="lw-chip">
                  {ref.label}
                  <button
                    type="button"
                    className="lw-chip__x"
                    aria-label={`Remove ${ref.label} from this thread`}
                    onClick={() => detach(ref)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                aria-expanded={picking}
                onClick={() => setPicking((o) => !o)}
              >
                + Context
              </button>
            </div>
            {active.context.length === 0 ? (
              <p className="lw-fieldnote">
                Nothing attached — the model is answering from your message alone.
              </p>
            ) : null}
          </div>

          {picking ? (
            <div className="lw-chatdock__picker" role="group" aria-label="Add context">
              {scene ? (
                <button
                  type="button"
                  className="lw-btn lw-btn--sm"
                  onClick={() =>
                    attach({
                      kind: 'scene',
                      id: scene.id,
                      label: `Scene: ${scene.title || 'Untitled'}`,
                    })
                  }
                >
                  This scene
                </button>
              ) : null}
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                onClick={() => attach({ kind: 'story-so-far', id: '', label: 'The story so far' })}
              >
                The story so far
              </button>
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                onClick={() => attach({ kind: 'outline', id: '', label: 'The outline' })}
              >
                The outline
              </button>
              <label className="lw-chatdock__pick">
                <span className="lw-visually-hidden">Add a codex type</span>
                <select
                  className="lw-input lw-input--sm"
                  value=""
                  aria-label="Add a codex type"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const type = e.target.value as (typeof available)[number];
                    attach({
                      kind: 'codex-type',
                      id: type,
                      label: `All ${ENTITY_TYPE_META[type].plural.toLowerCase()}`,
                    });
                  }}
                >
                  <option value="">A whole codex type…</option>
                  {available.map((type) => (
                    <option key={type} value={type}>
                      {ENTITY_TYPE_META[type].plural}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lw-chatdock__pick">
                <span className="lw-visually-hidden">Add an entry</span>
                <select
                  className="lw-input lw-input--sm"
                  value=""
                  aria-label="Add an entry"
                  onChange={(e) => {
                    const entity = entities.find((c) => c.id === e.target.value);
                    if (!entity) return;
                    attach({ kind: 'entity', id: entity.id, label: entity.name });
                  }}
                >
                  <option value="">One entry…</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {ENTITY_TYPE_META[entity.type].label} · {entity.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="lw-chatdock__log" data-testid="chat-log">
            {messages.length === 0 ? (
              <p className="lw-empty__note">
                Ask about the story. What travels is the chips above, and nothing else.
              </p>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className="lw-chatmsg"
                  data-role={message.role}
                  data-testid={`chat-${message.role}`}
                >
                  <span className="lw-chatmsg__who">
                    {message.role === 'user' ? 'You' : 'Reply'}
                  </span>
                  <p className="lw-chatmsg__text">{message.text}</p>
                  {message.truncated ? (
                    <p className="lw-fieldnote">The model stopped early — this reply is cut off.</p>
                  ) : null}
                  {message.contextSummary ? (
                    <p className="lw-chatmsg__ctx">Sent with: {message.contextSummary}</p>
                  ) : null}
                  {message.role === 'assistant' ? (
                    <div className="lw-chatmsg__acts">
                      <button
                        type="button"
                        className="lw-btn lw-btn--sm"
                        onClick={() => void insertInto(message.text)}
                      >
                        Insert into scene
                      </button>
                      <button
                        type="button"
                        className="lw-btn lw-btn--sm"
                        onClick={() => void sendToCodex(message.text)}
                      >
                        Send to codex
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>

          {confirming ? (
            <PrivacyConfirm
              projectId={projectId}
              note="This sends the attached material and this thread’s recent turns to your provider."
              onRun={() => void send()}
              onCancel={() => setConfirming(false)}
            />
          ) : null}

          <div className="lw-field lw-field--full">
            <label htmlFor="chat-input" className="lw-visually-hidden">
              Message
            </label>
            <textarea
              id="chat-input"
              className="lw-input lw-input--area"
              rows={3}
              placeholder="What do you want to work out?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="lw-chips__add">
              {aiReady ? (
                <button
                  type="button"
                  className="lw-btn lw-btn--primary lw-btn--sm"
                  disabled={busy || !input.trim()}
                  onClick={() => void onSend()}
                >
                  {busy ? 'Thinking…' : 'Send'}
                </button>
              ) : null}
              {/* Present with or without a key — this is the whole
                  conversation, not a reduced one. */}
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                onClick={() => void copyConversation()}
              >
                Copy conversation
              </button>
            </div>
          </div>

          {promptText ? (
            <div className="lw-field lw-field--full">
              <label htmlFor="chat-prompt">Prompt to send</label>
              <textarea id="chat-prompt" className="lw-input lw-input--area" rows={4} readOnly value={promptText} />
              <label htmlFor="chat-paste">Paste the reply</label>
              <textarea
                id="chat-paste"
                className="lw-input lw-input--area"
                rows={4}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                disabled={!pasted.trim()}
                onClick={() => void takePasted()}
              >
                Add reply
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
