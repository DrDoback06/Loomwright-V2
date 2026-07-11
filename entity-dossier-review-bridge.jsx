// =====================================================================
// entity-dossier-review-bridge.jsx — keep canonical records reachable while
// an entity panel is prioritising its Impact Review queue.
//
// The existing EntityReviewQueue remains authoritative. This wrapper derives
// affected entity links from its live items and can temporarily show the same
// LiveEntityDossier used by roster detail views, then return to review.
// =====================================================================

(function () {
  if (typeof EntityReviewQueue === "undefined" || typeof LiveEntityDossier === "undefined") return;

  const BaseEntityReviewQueueForDossier = EntityReviewQueue;
  const { useState, useMemo } = React;

  function entityReference(id, fallbackType) {
    if (!id) return null;
    const backend = window.LoomwrightBackend;
    const entity = backend?.EntityService?.getSync?.(id, fallbackType)
      || backend?.EntityDossierService?.storySnapshot?.().entityById?.get(id)
      || null;
    return entity ? { id: entity.id, name: entity.name, type: entity.type || fallbackType } : null;
  }

  function reviewEntityRefs(items = [], fallbackType) {
    const refs = [];
    const seen = new Set();
    for (const item of items || []) {
      const ids = [
        item.existingEntityId,
        item.targetEntityId,
        item.entityId,
        ...(item.relatedEntityIds || []),
        ...(item.impactReceipt?.affectedEntityIds || []),
      ].filter(Boolean);
      for (const id of ids) {
        if (seen.has(id)) continue;
        const ref = entityReference(id, item.entityType || item.type || fallbackType);
        if (!ref) continue;
        seen.add(id);
        refs.push(ref);
      }
    }
    return refs.slice(0, 18);
  }

  EntityReviewQueue = function DossierReachableEntityReviewQueue(props) {
    const [openRef, setOpenRef] = useState(null);
    const refs = useMemo(
      () => reviewEntityRefs(props.items || [], props.entityType),
      [props.items, props.entityType],
    );

    if (openRef) {
      return (
        <div data-ui="ImpactReviewEntityDossierBridge" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-paper-2)" }}>
            <button className="rpg-btn rpg-btn--small" onClick={() => setOpenRef(null)} data-testid="dossier-back-to-review">← Back to Impact Review</button>
            <span style={{ flex: 1, color: "var(--ink-4)", font: "italic 10px/1.3 var(--font-serif)" }}>Review remains unchanged; this is the canonical live entity record.</span>
          </div>
          <LiveEntityDossier entity={openRef}/>
        </div>
      );
    }

    return (
      <div data-ui="DossierReachableReviewQueue" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        {refs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-paper-2)" }}>
            <span style={{ marginRight: 3, color: "var(--ink-4)", font: "700 8px/1 var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em" }}>Affected dossiers</span>
            {refs.map((ref) => (
              <button
                key={ref.id}
                className="rpg-btn rpg-btn--small"
                data-testid={`ent-row-${ref.id}`}
                onClick={() => setOpenRef(ref)}
                title={`Open ${ref.name} without leaving Impact Review`}
              >
                {window.ENTITY_TYPES?.[ref.type]?.glyph || "·"} {ref.name}
              </button>
            ))}
          </div>
        )}
        <BaseEntityReviewQueueForDossier {...props}/>
      </div>
    );
  };

  window.EntityReviewQueue = EntityReviewQueue;
})();
