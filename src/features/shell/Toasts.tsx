import { useToastStore } from '@/stores/toasts';

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="lw-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`lw-toast lw-toast--${t.kind}`}>
          <span className="lw-toast__msg">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="lw-toast__action"
              onClick={() => {
                void t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          {t.actions?.map((a) => (
            <button
              key={a.label}
              type="button"
              className="lw-toast__action"
              onClick={() => {
                void a.run();
                dismiss(t.id);
              }}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            className="lw-toast__x"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
