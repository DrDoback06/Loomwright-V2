import { saveAiSettings } from '@/services/ai/settings';

/** The privacy guard shown before any AI call when settings.privacy is
 * 'ask' — shared by the Compose panel and the generation dialog. */
export function PrivacyConfirm({
  projectId,
  note,
  onRun,
  onCancel,
}: {
  projectId: string;
  note: string;
  onRun: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="lw-mergebox lw-card" data-testid="privacy-guard">
      <p className="lw-mergebox__note">{note}</p>
      <div className="lw-chips__add">
        <button
          type="button"
          className="lw-btn lw-btn--primary"
          onClick={() => {
            void onRun();
          }}
        >
          Send once
        </button>
        <button
          type="button"
          className="lw-btn"
          onClick={async () => {
            await saveAiSettings(projectId, { privacy: 'always-allow' });
            void onRun();
          }}
        >
          Always allow
        </button>
        <button type="button" className="lw-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
