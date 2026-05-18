// =====================================================================
// review-modals.jsx — MergeCandidateModal + EditCandidateModal + DenyConfirm
// =====================================================================

const { useState: _rmUS } = React;

// ---------------------------------------------------------------------
// MergeCandidateModal — three-pane comparison
// ---------------------------------------------------------------------
const MergeCandidateModal = ({
  open,
  candidate,                // QueueItem
  alternatives = [],        // [{ id, name, confidence, summary, aliases, fields:{...} }]
  selectedAltId,
  onSelectAlternative,
  onConfirmMerge,
  onCreateNewInstead,
  onCancel,
}) => {
  if (!open || !candidate) return null;
  const [altId, setAltId] = _rmUS(selectedAltId || alternatives[0]?.id);
  const alt = alternatives.find((a) => a.id === altId) || alternatives[0];
  const t = ENTITY_TYPES[candidate.entityType];

  const conflictFields = candidate.conflict ? [candidate.conflict.kind] : [];

  return (
    <div className="mc-backdrop" role="dialog" aria-modal="true" aria-labelledby="mc-title">
      <div className="mc" data-ui="MergeCandidateModal" data-testid="merge-candidate-modal">
        <div className="mc__head">
          <div>
            <div className="mc__title" id="mc-title">Merge candidate?</div>
            <div className="mc__sub">Decide whether the extracted mention is a new entry or refers to an existing one.</div>
          </div>
          <Btn variant="ghost" size="sm" icon="close" onClick={onCancel} aria-label="Close" data-callback="onClosePanel"/>
        </div>

        <div className="mc__body">
          {/* LEFT — extracted candidate */}
          <div className="mc__col mc__col--left">
            <div className="mc__col__eyebrow">
              <span>Extracted</span>
              <ConfidenceBadge level={candidate.confidence?.band} value={candidate.confidence?.value}/>
            </div>
            <div className="mc__col__name-row">
              <EntityTypeBadge type={candidate.entityType} size="sm"/>
              <div className="mc__col__title">{candidate.candidate?.name}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Aliases</div>
              <div className="mc__field__val">{candidate.candidate?.aliases?.join(", ") || "—"}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Summary</div>
              <div className="mc__field__val">{candidate.candidate?.summary}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Mention</div>
              <div className="mc__field__val" style={{ fontStyle: "italic" }}>"{candidate.mention}"</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Source</div>
              <div className="mc__field__val mc__field__val--mono">Ch. {candidate.sourceChapter?.num} · {candidate.sourceParagraph}</div>
            </div>
            <div className="mc__field">
              <div className="mc__field__lbl">Why</div>
              <div className="mc__field__val">{candidate.rationale}</div>
            </div>
          </div>

          {/* SEPARATOR */}
          <div className="mc__sep">
            <div className="mc__sep__line" aria-hidden/>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-4)", position: "relative" }}>
              <span className="mc__sep__chip">SIMILARITY</span>
              <span className="mc__similarity">{alt?.confidence ?? "—"}<span style={{ fontSize: "var(--fs-md)", color: "var(--ink-3)" }}>%</span></span>
              {candidate.matched && candidate.matched.id === alt?.id && (
                <span className="mc__sep__chip" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent-deep)" }}>
                  <Icon name="check" size={10}/>Alias match
                </span>
              )}
            </div>
          </div>

          {/* RIGHT — existing entity candidates */}
          <div className="mc__col mc__col--right">
            <div className="mc__col__eyebrow">
              <span>Existing entries · {alternatives.length}</span>
            </div>
            <div className="mc__alts">
              {alternatives.map((a) => (
                <div key={a.id} className={"mc__alt-row " + (a.id === altId ? "is-selected" : "")} onClick={() => { setAltId(a.id); onSelectAlternative && onSelectAlternative(a.id); }} data-callback="onSelectMergeAlternative">
                  <EntityTypeBadge type={candidate.entityType} size="xs"/>
                  <span className="mc__alt-row__name">{a.name}</span>
                  <span className="mc__alt-row__sim">{a.confidence}%</span>
                </div>
              ))}
              {alternatives.length === 0 && (
                <EmptyState icon="search" title="No close matches" body="No existing entries look similar enough. Create a new entry instead."/>
              )}
            </div>

            {alt && (
              <>
                <div className="mc__col__name-row" style={{ marginTop: "var(--sp-5)" }}>
                  <EntityTypeBadge type={candidate.entityType} size="sm"/>
                  <div className="mc__col__title">{alt.name}</div>
                </div>
                <div className="mc__field mc__field--match">
                  <div className="mc__field__lbl">Aliases</div>
                  <div className="mc__field__val">{alt.aliases?.join(", ") || "—"}</div>
                </div>
                <div className="mc__field mc__field--match">
                  <div className="mc__field__lbl">Summary</div>
                  <div className="mc__field__val">{alt.summary || "(existing dossier)"}</div>
                </div>
                {candidate.conflict && (
                  <div className="mc__field mc__field--conflict">
                    <div className="mc__field__lbl">Conflict</div>
                    <div className="mc__field__val">{candidate.conflict.note}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mc__foot">
          <div className="mc__foot__hint">
            {candidate.conflict
              ? <><Icon name="warn" size={12}/>{conflictFields.join(", ")} conflict — review before merging.</>
              : <><Icon name="link" size={12}/>Merging will fold the extracted mention into the existing dossier.</>}
          </div>
          <div className="mc__foot__actions">
            <Btn variant="ghost"   size="sm" onClick={onCancel} data-callback="onCancelMerge">Cancel</Btn>
            <Btn variant="outline" size="sm" icon="plus" onClick={onCreateNewInstead} data-callback="onCreateNewInstead" data-testid="merge-create-new">Create new instead</Btn>
            <Btn variant="primary" size="sm" icon="link" onClick={() => onConfirmMerge && onConfirmMerge(altId)} data-callback="onMergeQueueItem" data-testid="merge-confirm">Confirm merge</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EditCandidateModal
// ---------------------------------------------------------------------
const EditCandidateModal = ({
  open,
  candidate,
  targetTabs = [],          // [{ id, label }]
  onSave, onAcceptEdited, onCancel,
}) => {
  if (!open || !candidate) return null;
  const c = candidate;
  const [name, setName]       = _rmUS(c.candidate?.name || "");
  const [type, setType]       = _rmUS(c.entityType);
  const [aliases, setAliases] = _rmUS((c.candidate?.aliases || []).join(", "));
  const [summary, setSummary] = _rmUS(c.candidate?.summary || "");
  const [notes, setNotes]     = _rmUS("");
  const [confidence, setConf] = _rmUS(c.confidence?.band || "uncertain");
  const [target, setTarget]   = _rmUS(c.entityType);

  const buildEdited = () => ({
    ...c,
    entityType: type,
    candidate: { ...c.candidate, name, aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean), summary },
    confidence: { ...c.confidence, band: confidence },
    targetTab: target,
    notes,
    status: "edited",
  });

  return (
    <div className="ec-backdrop" role="dialog" aria-modal="true" aria-labelledby="ec-title">
      <div className="ec" data-ui="EditCandidateModal" data-testid="edit-candidate-modal">
        <div className="ec__head">
          <div>
            <div className="ec__title" id="ec-title">Edit candidate</div>
            <div className="ec__sub">Tune the extracted record before adding it to the dossier.</div>
          </div>
          <Btn variant="ghost" size="sm" icon="close" onClick={onCancel} aria-label="Close" data-callback="onClosePanel"/>
        </div>

        <div className="ec__body">
          <div className="ec__field--row">
            <div className="ec__field">
              <div className="ec__field__lbl">Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} data-testid="edit-name"/>
            </div>
            <div className="ec__field">
              <div className="ec__field__lbl">Type</div>
              <select value={type} onChange={(e) => setType(e.target.value)} data-testid="edit-type">
                {Object.values(ENTITY_TYPES).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Aliases (comma-separated)</div>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)}/>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Summary</div>
            <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)}/>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Source quote</div>
            <div className="ec__quote">"{c.mention}"</div>
          </div>

          <div className="ec__field">
            <div className="ec__field__lbl">Notes (private)</div>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for your dossier"/>
          </div>

          <div className="ec__field--row">
            <div className="ec__field">
              <div className="ec__field__lbl">Confidence band</div>
              <select value={confidence} onChange={(e) => setConf(e.target.value)}>
                {Object.values(CONFIDENCE).map((b) => <option key={b.id} value={b.id}>{b.label} · {b.range}</option>)}
              </select>
            </div>
            <div className="ec__field">
              <div className="ec__field__lbl">Target tab</div>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                {(targetTabs.length ? targetTabs : Object.values(ENTITY_TYPES).map((t) => ({ id: t.id, label: t.label })))
                  .map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="ec__foot">
          <div className="ec__foot__hint"><Icon name="paper" size={12}/>Edits stay attached to the source extraction.</div>
          <div className="ec__foot__actions">
            <Btn variant="ghost"   size="sm" onClick={onCancel} data-callback="onCancelEdit">Cancel</Btn>
            <Btn variant="outline" size="sm" icon="check" onClick={() => onSave && onSave(buildEdited())} data-callback="onSaveEdit" data-testid="edit-save">Save changes</Btn>
            <Btn variant="primary" size="sm" icon="bolt"  onClick={() => onAcceptEdited && onAcceptEdited(buildEdited())} data-callback="onAcceptEdited" data-testid="edit-accept">Accept edited version</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// DenyConfirmation — wraps ConfirmModal with candidate context
// ---------------------------------------------------------------------
const DenyConfirmation = ({ open, candidate, onConfirm, onCancel }) => {
  if (!open || !candidate) return null;
  return (
    <ConfirmModal
      open={open}
      title={"Deny \"" + (candidate.candidate?.name || "this candidate") + "\"?"}
      tone="danger"
      confirmLabel="Deny candidate"
      cancelLabel="Keep in queue"
      onConfirm={onConfirm}
      onCancel={onCancel}
      body={
        <>
          <p>This will remove the suggestion from the {ENTITY_TYPES[candidate.entityType]?.label || "review"} queue. The mention itself stays in your manuscript.</p>
          <div className="dc-context">
            "{candidate.mention}"
          </div>
          <p style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>
            Denied items appear in extraction history. You can recover them within 30 days.
          </p>
        </>
      }
    />
  );
};

Object.assign(window, { MergeCandidateModal, EditCandidateModal, DenyConfirmation });
