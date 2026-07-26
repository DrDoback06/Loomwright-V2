import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { newId } from '@/lib/id';
import { undoAuditEntry } from '@/db/repos/undo';
import {
  dismissSuggestion,
  listSuggestionsFor,
  markSuggestionAccepted,
  pruneSuggestions,
} from '@/db/repos/suggestions';
import { applyDelta } from '@/services/intelligence/apply';
import { emptyDelta, type SuggestionRecord } from '@/services/intelligence/types';
import { toast } from '@/stores/toasts';

const KIND_LABEL: Record<SuggestionRecord['kind'], string> = {
  'skill-sibling': 'Sibling skill',
  'skill-next-tier': 'Next tier',
  'quest-outcome': 'Quest outcome',
  'story-arc': 'Story arc',
  relationship: 'Bond',
  'item-synergy': 'Synergy',
  'cast-candidate': 'Who else',
};

/**
 * The per-entity Suggestions inbox, rendered as dossier chips.
 *
 * Each chip is a finished card, not a question: accepting one with a payload
 * stages and applies a real mini-delta (with its own Undo); dismissing one
 * makes it gone for good. Suggestions with no payload are prompts for the
 * author to act on themselves, so they only offer Dismiss.
 */
export function SuggestionChips({ projectId, entityId }: { projectId: string; entityId: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  const suggestions = useLiveQuery(
    async () => listSuggestionsFor(projectId, entityId),
    [projectId, entityId],
    [] as SuggestionRecord[]
  );

  if (!suggestions.length) return null;

  const accept = async (row: SuggestionRecord) => {
    setBusy(row.id);
    try {
      if (!row.payload) {
        await markSuggestionAccepted(row.id);
        toast('Marked as taken.', { kind: 'success' });
        return;
      }
      const delta = {
        ...emptyDelta(newId(), projectId, row.source),
        ...row.payload,
        createdAt: Date.now(),
      };
      const result = await applyDelta(delta);
      await markSuggestionAccepted(row.id);
      await pruneSuggestions(projectId);
      toast(`${row.title} added.`, {
        kind: 'success',
        action: {
          label: 'Undo',
          run: async () => {
            await undoAuditEntry(result.auditId);
            toast('Suggestion undone.', { kind: 'success' });
          },
        },
      });
    } catch {
      toast('Could not apply that suggestion — nothing was written.', { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (row: SuggestionRecord) => {
    await dismissSuggestion(row.id);
    await pruneSuggestions(projectId);
  };

  return (
    <section className="lw-suggestions" data-testid="suggestion-chips">
      <h3 className="lw-suggestions__title">
        Suggestions <span className="lw-suggestions__count">{suggestions.length}</span>
      </h3>
      <ul className="lw-suggestions__list">
        {suggestions.map((row) => (
          <li key={row.id} className="lw-suggestion" data-testid="suggestion-chip">
            <div className="lw-suggestion__body">
              <span className="lw-suggestion__kind">{KIND_LABEL[row.kind]}</span>
              <strong className="lw-suggestion__title">{row.title}</strong>
              <p className="lw-suggestion__text">{row.body}</p>
            </div>
            <div className="lw-suggestion__actions">
              <button
                type="button"
                className="lw-btn lw-btn--sm lw-btn--primary"
                disabled={busy === row.id}
                onClick={() => void accept(row)}
              >
                {row.payload ? 'Accept' : 'Mark taken'}
              </button>
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                disabled={busy === row.id}
                onClick={() => void dismiss(row)}
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
