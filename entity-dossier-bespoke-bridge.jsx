// =====================================================================
// entity-dossier-bespoke-bridge.jsx — preserve bespoke panel bodies while
// attaching the shared live dossier to their current selection.
// =====================================================================

(function () {
  if (typeof LiveEntityDossier === "undefined") return;

  const { useState, useEffect, useMemo } = React;
  const REFRESH_EVENTS = [
    "lw:entity-store-updated",
    "lw:occurrence-store-updated",
    "lw:occurrences-updated",
    "lw:review-queue-updated",
    "lw:impact-review-updated",
    "lw:manuscript-chapters-updated",
    "lw:references-updated",
    "lw:project-imported",
  ];

  function makeBridge(BaseBody, entityType, label) {
    if (!BaseBody || BaseBody.__liveDossierBridge) return BaseBody;

    const BridgedBody = function LiveDossierBespokeBridge(props) {
      const listNow = () => window.LoomwrightBackend?.EntityService?.listSync?.(entityType) || [];
      const [selectedId, setSelectedId] = useState(() => (
        props.panel?.selected?.id
        || props.panel?.selectedId
        || listNow()[0]?.id
        || null
      ));
      const [tick, setTick] = useState(0);

      useEffect(() => {
        const bump = () => setTick((value) => value + 1);
        REFRESH_EVENTS.forEach((name) => window.addEventListener(name, bump));
        return () => REFRESH_EVENTS.forEach((name) => window.removeEventListener(name, bump));
      }, []);

      const entities = useMemo(() => {
        void tick;
        return listNow();
      }, [tick]);

      useEffect(() => {
        if (!entities.length) {
          if (selectedId) setSelectedId(null);
          return;
        }
        if (!selectedId || !entities.some((entity) => entity.id === selectedId)) {
          setSelectedId(entities[0].id);
        }
      }, [entities, selectedId]);

      const selectedEntity = entities.find((entity) => entity.id === selectedId) || null;
      const onSelectEntity = (reference) => {
        const id = reference?.id || reference?.entityId || null;
        const type = reference?.type || reference?.entityType || entityType;
        if (id && type === entityType) setSelectedId(id);
        props.onSelectEntity?.(reference);
      };

      return (
        <div className="led-bespoke-bridge" data-ui="LiveDossierBespokeBridge" data-entity-type={entityType}>
          <BaseBody {...props} onSelectEntity={onSelectEntity}/>
          {selectedEntity && (
            <section className="led-bespoke-bridge__dossier" data-ui={`${label}LiveDossierExtension`}>
              <LiveEntityDossier
                entity={selectedEntity}
                heading={`Living ${label.toLowerCase()} intelligence`}
              />
            </section>
          )}
        </div>
      );
    };

    BridgedBody.__liveDossierBridge = true;
    return BridgedBody;
  }

  if (typeof ItemsPanelBody !== "undefined") {
    ItemsPanelBody = makeBridge(ItemsPanelBody, "items", "Item");
    window.ItemsPanelBody = ItemsPanelBody;
  }

  if (typeof LocationsPanelBody !== "undefined") {
    LocationsPanelBody = makeBridge(LocationsPanelBody, "locations", "Location");
    window.LocationsPanelBody = LocationsPanelBody;
  }
})();
