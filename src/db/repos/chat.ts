import { db } from '../schema';
import { newId } from '@/lib/id';
import type { ChatContextRef, ChatMessage, ChatMode, ChatThread } from '../types';

/** Enough history to hold a conversation, few enough to still fit. Their
 * "knowledge cutoff" by another name; the thread can change it. */
export const DEFAULT_MEMORY_PAIRS = 14;

export async function listThreads(projectId: string): Promise<ChatThread[]> {
  const rows = await db.chatThreads.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createThread(
  projectId: string,
  opts: { sceneId?: string | null; mode?: ChatMode; context?: ChatContextRef[] } = {}
): Promise<ChatThread> {
  const now = Date.now();
  const thread: ChatThread = {
    id: newId(),
    projectId,
    sceneId: opts.sceneId ?? null,
    title: 'New thread',
    mode: opts.mode ?? 'brainstorm',
    context: opts.context ?? [],
    memoryPairs: DEFAULT_MEMORY_PAIRS,
    createdAt: now,
    updatedAt: now,
  };
  await db.chatThreads.add(thread);
  return thread;
}

export async function updateThread(id: string, patch: Partial<ChatThread>): Promise<void> {
  await db.chatThreads.update(id, { ...patch, updatedAt: Date.now() });
}

/** Threads are working notes, not manuscript, so this is a hard delete
 * rather than a trip through the trash — and it takes its messages with
 * it, which is the whole reason it is not two calls at the call site. */
export async function deleteThread(id: string): Promise<void> {
  await db.transaction('rw', [db.chatThreads, db.chatMessages], async () => {
    const messages = await db.chatMessages.where('threadId').equals(id).toArray();
    await db.chatMessages.bulkDelete(messages.map((m) => m.id));
    await db.chatThreads.delete(id);
  });
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const rows = await db.chatMessages.where('threadId').equals(threadId).toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addMessage(
  threadId: string,
  role: ChatMessage['role'],
  text: string,
  extra: { contextSummary?: string; truncated?: boolean } = {}
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: newId(),
    threadId,
    role,
    text,
    ...extra,
    createdAt: Date.now(),
  };
  await db.chatMessages.add(message);
  // A thread with no title takes the first thing the author said. Better
  // than "New thread" forever, and better than asking.
  const thread = await db.chatThreads.get(threadId);
  if (thread) {
    const title =
      thread.title === 'New thread' && role === 'user' ? titleFrom(text) : thread.title;
    await db.chatThreads.update(threadId, { title, updatedAt: message.createdAt });
  }
  return message;
}

export function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0].trim();
  if (!line) return 'New thread';
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}
