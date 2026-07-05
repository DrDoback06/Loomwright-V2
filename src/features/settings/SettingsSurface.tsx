import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { DETECTOR_BASE_CONFIDENCE } from '@/services/extraction/detectors';
import { PROVIDERS, testConnection, type ProviderId } from '@/services/ai/providers';
import { getAiSettings, saveAiSettings, type AiSettings } from '@/services/ai/settings';
import { exportProject, importProject } from '@/services/archive/project';
import { renderWorldBible } from '@/services/archive/world-bible';
import { clearApiKey, listKeyedProviders, saveApiKey } from '@/services/crypto/keys';
import { downloadFile, fileStem } from '@/lib/download';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

/** Settings: AI providers (BYOK), privacy, and extraction tuning. Keys
 * are encrypted at rest and never leave this browser except to the
 * provider you configured. */
export function SettingsSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [keyed, setKeyed] = useState<string[]>([]);
  const [keyDrafts, setKeyDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [testResult, setTestResult] = useState<{ provider: ProviderId; ok: boolean; detail: string } | null>(null);

  const refresh = async () => {
    if (!projectId) return;
    setAi(await getAiSettings(projectId));
    setKeyed(await listKeyedProviders());
  };
  useEffect(() => {
    void refresh();
     
  }, [projectId]);

  const extraction = useLiveQuery(
    async () => {
      if (!projectId) return {};
      const row = await db.settings.get(`${projectId}:extraction`);
      return ((row?.value as { detectorConfidence?: Record<string, number> })?.detectorConfidence ?? {});
    },
    [projectId],
    {} as Record<string, number>
  );

  if (!projectId || !ai) return null;

  const patchAi = async (patch: Partial<AiSettings>) => {
    await saveAiSettings(projectId, patch);
    await refresh();
  };

  const saveKey = async (provider: ProviderId) => {
    const draft = keyDrafts[provider]?.trim();
    if (!draft) return;
    await saveApiKey(provider, draft);
    setKeyDrafts((d) => ({ ...d, [provider]: '' }));
    await refresh();
    toast(`${PROVIDERS[provider].label} key saved (encrypted on this device).`, { kind: 'success' });
    if (!ai.defaultProvider) await patchAi({ defaultProvider: provider });
  };

  const setDetector = async (id: string, value: number) => {
    const row = await db.settings.get(`${projectId}:extraction`);
    const current = (row?.value as { detectorConfidence?: Record<string, number> }) ?? {};
    await db.settings.put({
      key: `${projectId}:extraction`,
      value: {
        ...current,
        detectorConfidence: { ...(current.detectorConfidence ?? {}), [id]: value },
      },
    });
  };

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-settings">
      <div>
        <h1 className="lw-page__title">Settings</h1>
        <p className="lw-page__subtitle">
          Loomwright is local-first. AI is bring-your-own-key: we never proxy or store your
          key anywhere but this browser, encrypted.
        </p>
      </div>

      <section className="lw-card">
        <h2 className="lw-card__title">AI mode</h2>
        <label className="lw-toggle">
          <input
            type="checkbox"
            checked={ai.mode === 'local-only'}
            onChange={(e) => void patchAi({ mode: e.target.checked ? 'local-only' : 'byok' })}
          />
          <span>
            Local-only mode — block every external AI call. Extraction and all tracking keep
            working offline.
          </span>
        </label>
        <label className="lw-toggle" style={{ marginTop: 'var(--sp-4)' }}>
          <input
            type="checkbox"
            checked={ai.privacy === 'ask'}
            onChange={(e) => void patchAi({ privacy: e.target.checked ? 'ask' : 'always-allow' })}
          />
          <span>Ask before sending manuscript text to a provider (privacy guard).</span>
        </label>
      </section>

      <section className="lw-card" data-testid="settings-providers">
        <h2 className="lw-card__title">AI providers (bring your own key)</h2>
        <div className="lw-providers">
          {Object.values(PROVIDERS).map((meta) => {
            const hasKey = keyed.includes(meta.id);
            const isDefault = ai.defaultProvider === meta.id;
            return (
              <div key={meta.id} className="lw-provider" data-testid={`provider-${meta.id}`}>
                <div className="lw-provider__head">
                  <label className="lw-toggle">
                    <input
                      type="radio"
                      name="default-provider"
                      checked={isDefault}
                      onChange={() => void patchAi({ defaultProvider: meta.id })}
                    />
                    <span>
                      <strong>{meta.label}</strong>{' '}
                      <span className="lw-fieldnote-inline">({meta.defaultModel})</span>
                    </span>
                  </label>
                  {hasKey ? (
                    <span className="lw-provider__keyed">key saved ✓</span>
                  ) : meta.needsKey ? (
                    <span className="lw-provider__nokey">no key</span>
                  ) : (
                    <span className="lw-provider__keyed">no key needed</span>
                  )}
                </div>
                {meta.needsKey && (
                  <div className="lw-chips__add">
                    <input
                      className="lw-input"
                      type="password"
                      aria-label={`${meta.label} API key`}
                      placeholder={hasKey ? 'Replace key…' : meta.keyHint}
                      value={keyDrafts[meta.id] ?? ''}
                      onChange={(e) => setKeyDrafts((d) => ({ ...d, [meta.id]: e.target.value }))}
                    />
                    <button type="button" className="lw-btn" onClick={() => void saveKey(meta.id)}>
                      Save key
                    </button>
                    {hasKey && (
                      <button
                        type="button"
                        className="lw-btn"
                        onClick={async () => {
                          await clearApiKey(meta.id);
                          await refresh();
                          toast(`${meta.label} key removed.`);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                <div className="lw-chips__add">
                  <button
                    type="button"
                    className="lw-btn"
                    disabled={testing === meta.id || (meta.needsKey && !hasKey)}
                    onClick={async () => {
                      setTesting(meta.id);
                      setTestResult(null);
                      const override = ai.overrides[meta.id] ?? {};
                      const result = await testConnection({ provider: meta.id, ...override });
                      setTestResult({ provider: meta.id, ...result });
                      setTesting(null);
                    }}
                  >
                    {testing === meta.id ? 'Testing…' : 'Test connection'}
                  </button>
                  {testResult?.provider === meta.id && (
                    <span
                      className={testResult.ok ? 'lw-provider__ok' : 'lw-provider__err'}
                      data-testid={`test-result-${meta.id}`}
                    >
                      {testResult.ok ? '✓ ' : '✗ '}
                      {testResult.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="lw-card" data-testid="settings-data">
        <h2 className="lw-card__title">Data &amp; interchange</h2>
        <p className="lw-fieldnote">
          Everything below is a plain local file — nothing is uploaded anywhere. API keys are
          never included in any export.
        </p>
        <div className="lw-chips__add" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="lw-btn"
            onClick={async () => {
              const archive = await exportProject(projectId);
              downloadFile(
                `${fileStem(archive.project.name)}.loomwright.json`,
                JSON.stringify(archive, null, 2),
                'application/json'
              );
              toast('Project exported.', { kind: 'success' });
            }}
          >
            Export project (.json)
          </button>
          <button type="button" className="lw-btn" onClick={() => importInputRef.current?.click()}>
            Import project…
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import project file"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const result = await importProject(JSON.parse(await file.text()));
                setCurrentProject(result.projectId);
                toast(
                  `Imported “${result.name}” — ${result.counts.entities} entries, ${result.counts.chapters} chapters. You're now in the imported project.`,
                  { kind: 'success' }
                );
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Import failed.', { kind: 'error' });
              }
            }}
          />
          <button
            type="button"
            className="lw-btn"
            onClick={async () => {
              const project = await db.projects.get(projectId);
              const { markdown } = await renderWorldBible(projectId);
              downloadFile(`${fileStem(project?.name ?? '')}-world-bible.md`, markdown, 'text/markdown');
              toast('World bible exported (Markdown).', { kind: 'success' });
            }}
          >
            World bible (.md)
          </button>
          <button
            type="button"
            className="lw-btn"
            onClick={async () => {
              const project = await db.projects.get(projectId);
              const { html } = await renderWorldBible(projectId);
              downloadFile(`${fileStem(project?.name ?? '')}-world-bible.html`, html, 'text/html');
              toast('World bible exported (HTML).', { kind: 'success' });
            }}
          >
            World bible (.html)
          </button>
        </div>
      </section>

      <section className="lw-card" data-testid="settings-extraction">
        <h2 className="lw-card__title">Extraction tuning</h2>
        <p className="lw-fieldnote">
          Per-detector confidence. Lower = more candidates (more noise); higher = fewer,
          surer ones.
        </p>
        <div className="lw-detectors">
          {Object.entries(DETECTOR_BASE_CONFIDENCE).map(([id, base]) => {
            const value = extraction[id] ?? base;
            return (
              <label key={id} className="lw-detector">
                <span className="lw-detector__name">{id}</span>
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.01}
                  value={value}
                  aria-label={`${id} confidence`}
                  onChange={(e) => void setDetector(id, Number(e.target.value))}
                />
                <span className="lw-detector__value">{Math.round(value * 100)}%</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
