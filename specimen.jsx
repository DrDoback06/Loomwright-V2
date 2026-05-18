// =====================================================================
// specimen.jsx — Design system specimen / spec page
// =====================================================================

const Specimen = () => {
  const tokenSwatches = [
    { name: "bg-app",     v: "var(--bg-app)" },
    { name: "bg-paper",   v: "var(--bg-paper)" },
    { name: "bg-paper-2", v: "var(--bg-paper-2)" },
    { name: "bg-elev",    v: "var(--bg-elev)" },
    { name: "bg-sunken",  v: "var(--bg-sunken)" },
    { name: "ink-1",      v: "var(--ink-1)" },
    { name: "ink-2",      v: "var(--ink-2)" },
    { name: "ink-3",      v: "var(--ink-3)" },
    { name: "ink-4",      v: "var(--ink-4)" },
    { name: "accent",     v: "var(--accent)" },
    { name: "accent-deep",v: "var(--accent-deep)" },
    { name: "accent-soft",v: "var(--accent-soft)" },
  ];

  return (
    <div className="specimen" data-ui="Specimen">
      <div className="specimen__inner">
        <div className="specimen__hero">
          <div className="specimen__eyebrow">{BRAND.name} · Design System</div>
          <h1 className="specimen__title">Parchment, ink, and a quiet archive.</h1>
          <p className="specimen__lede">A premium writing workspace stitched from parchment surfaces, antique-gold accents, and a disciplined system of entity colours. Nothing neon. Nothing fantasy-clone.</p>
        </div>

        {/* Brand */}
        <section className="specimen__section">
          <h2>Brand namespace</h2>
          <p className="specimen__section__sub">All naming, taglines, and brand colours come from <code>brand</code>. Swap <code>brand.name</code> and the whole product renames.</p>
          <div className="specimen__grid specimen__grid--3">
            <div className="specimen-card">
              <div className="specimen-card__lbl">Logo marks</div>
              <div className="specimen-card__row" style={{ gap: 16 }}>
                {["wax-seal", "loom-glyph", "quill-thread", "letter-mark"].map((v) => (
                  <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <BrandMark variant={v} size={36}/>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--ink-3)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Identity</div>
              <div className="specimen-card__title" style={{ fontSize: "var(--fs-2xl)" }}>{BRAND.name}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)" }}>{BRAND.tagline}</div>
              <div className="specimen-card__code">brand.shortName = "{BRAND.shortName}"</div>
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Theme</div>
              <div className="specimen-card__row">
                <span className="chip chip--accent">{BRAND.theme}</span>
                <span className="chip chip--neutral">midnight-ink</span>
              </div>
              <div className="specimen-card__code">data-theme on &lt;html&gt;</div>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="specimen__section">
          <h2>Surfaces &amp; ink</h2>
          <p className="specimen__section__sub">Warm ivory paper, deep ink. Tokens carry across light and midnight themes.</p>
          <div className="specimen__grid specimen__grid--4">
            {tokenSwatches.map((s) => (
              <div key={s.name} className="swatch">
                <div className="swatch__chip" style={{ background: s.v }}/>
                <div className="swatch__meta">
                  <span className="swatch__name">{s.name}</span>
                  <span className="swatch__val">--{s.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Entity palette */}
        <section className="specimen__section">
          <h2>Entity palette</h2>
          <p className="specimen__section__sub">Each entity type has one colour used inside the manuscript (brush-stroke highlight) and across all entity UI. <strong>Never mixed with confidence colours.</strong></p>
          <div className="specimen__grid specimen__grid--3">
            {Object.values(ENTITY_TYPES).map((e) => (
              <div key={e.id} className="specimen-card">
                <div className="specimen-card__row">
                  <EntityTypeBadge type={e.id} size="md"/>
                  <span className="specimen-card__code">{e.color}</span>
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-md)", color: "var(--ink-2)", lineHeight: 1.55 }}>
                  …and at the gate stood{" "}
                  <span className="entity-mark" style={{ "--ec": e.color }}>{e.label === "Cast" ? "Aelinor" : e.label === "Locations" || e.label === "Atlas" ? "the Pale Reach" : e.label === "Items" ? "the Auger" : e.label === "Bestiary" ? "a hollow-thing" : e.label}</span>
                  , quiet as paper.
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Confidence palette */}
        <section className="specimen__section">
          <h2>Confidence palette</h2>
          <p className="specimen__section__sub">Used <em>only</em> in review queues, extraction cards, and margin reviews. Never inside manuscript prose.</p>
          <div className="specimen__grid specimen__grid--4">
            {Object.values(CONFIDENCE).map((c) => (
              <div key={c.id} className="specimen-card">
                <ConfidenceBadge level={c.id} value={c.id === "high" ? 96 : c.id === "strong" ? 84 : c.id === "uncertain" ? 62 : 38} showRange/>
                <div className="specimen-card__title" style={{ fontSize: "var(--fs-md)" }}>{c.label}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>Range: {c.range}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Type */}
        <section className="specimen__section">
          <h2>Type</h2>
          <p className="specimen__section__sub">Display serif for chapter titles and brand. Text serif for body and quoted prose. Sans for UI. Mono for metadata.</p>
          <div className="specimen-card">
            <div className="type-row">
              <div className="type-row__meta">display / 5xl / 500</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-5xl)", lineHeight: 1.05 }}>A small dark queen</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">display / 3xl / 500</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-3xl)" }}>Chapter the seventh</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">serif / xl / italic</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-xl)" }}>"Quiet as paper, the city held its breath."</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">serif / md</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-md)" }}>Body prose runs in a literary serif. The eye should slow, not strain.</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">sans / md / 500</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-md)", fontWeight: 500 }}>UI text — buttons, labels, panels, navigation.</div>
            </div>
            <div className="type-row">
              <div className="type-row__meta">mono / xs</div>
              <div className="type-row__sample" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>ch.07 · saved 14:02 · 1,832 words</div>
            </div>
          </div>
        </section>

        {/* Buttons + chips */}
        <section className="specimen__section">
          <h2>Buttons, chips &amp; badges</h2>
          <div className="specimen__grid specimen__grid--2">
            <div className="specimen-card">
              <div className="specimen-card__lbl">Buttons</div>
              <div className="specimen-card__row">
                <Btn variant="primary" icon="check">Save</Btn>
                <Btn variant="primary" icon="sparkle">Save + Extract</Btn>
                <Btn variant="outline" icon="plus">New chapter</Btn>
                <Btn variant="ghost" icon="more">More</Btn>
                <Btn variant="danger" icon="trash">Delete</Btn>
                <Btn disabled icon="lock">Locked</Btn>
              </div>
              <div className="specimen-card__row">
                <Btn variant="ghost" size="sm" icon="filter">Filter</Btn>
                <Btn variant="outline" size="sm" icon="sort">Sort</Btn>
                <Btn variant="ghost" size="sm" icon="bell">Queue</Btn>
              </div>
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Chips</div>
              <div className="specimen-card__row">
                <PrivacyModeChip mode="local"/>
                <PrivacyModeChip mode="cloud"/>
                <PrivacyModeChip mode="ai"/>
              </div>
              <div className="specimen-card__row">
                <SyncStateChip state="saved"/>
                <SyncStateChip state="unsaved"/>
                <SyncStateChip state="syncing"/>
                <SyncStateChip state="offline"/>
                <SyncStateChip state="error"/>
              </div>
              <div className="specimen-card__row">
                <ReviewCountBadge count={3}/>
                <ReviewCountBadge count={42}/>
                <ReviewCountBadge count={120}/>
              </div>
            </div>
          </div>
        </section>

        {/* States */}
        <section className="specimen__section">
          <h2>Empty · Loading · Error states</h2>
          <p className="specimen__section__sub">Reusable across every screen and panel.</p>
          <div className="specimen__grid specimen__grid--3">
            <div className="specimen-card" style={{ padding: 0, overflow: "hidden" }}>
              <EmptyState icon="paper" title="No quests yet" body="Create your first thread or run extraction on chapter 1." action={<Btn variant="primary" size="sm" icon="plus">Create</Btn>}/>
            </div>
            <div className="specimen-card" style={{ padding: 0, overflow: "hidden" }}>
              <LoadingState title="Loading cast…" lines={4}/>
            </div>
            <div className="specimen-card" style={{ padding: 0, overflow: "hidden" }}>
              <ErrorState title="Couldn't reach the archive" body="Local index didn't respond. Your manuscript is safe." onRetry={() => {}}/>
            </div>
          </div>
        </section>

        {/* Spacing & radii */}
        <section className="specimen__section">
          <h2>Spacing &amp; radii</h2>
          <div className="specimen__grid specimen__grid--2">
            <div className="specimen-card">
              <div className="specimen-card__lbl">Spacing</div>
              {[2, 4, 8, 12, 16, 24, 32, 48].map((px) => (
                <div key={px} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--ink-3)", width: 30 }}>{px}px</span>
                  <span style={{ height: 8, width: px, background: "var(--accent)", borderRadius: 2 }}/>
                </div>
              ))}
            </div>
            <div className="specimen-card">
              <div className="specimen-card__lbl">Radii</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {[2, 4, 6, 8, 14].map((r) => (
                  <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 44, height: 44, background: "var(--accent-soft)", border: "1px solid var(--line-2)", borderRadius: r }}/>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-2xs)", color: "var(--ink-3)" }}>{r}px</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mobile collapse notes */}
        <section className="specimen__section">
          <h2>Mobile collapse notes</h2>
          <div className="specimen-card">
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: "var(--fs-sm)", lineHeight: 1.65 }}>
              <li>Left rail collapses to a bottom nav with the four most-used routes; the rest live behind a drawer.</li>
              <li>Right utility rail folds into the bottom-sheet stack — Review, Today, Recent each open as full-screen sheets.</li>
              <li>Sliding panels become full-screen sheets, dismissed by swipe-down. Stacking is replaced with breadcrumbed back navigation.</li>
              <li>Margins (review chips beside paragraphs) collapse into bottom cards beneath the active paragraph.</li>
              <li>Adaptive Wheel is invoked by long-press anywhere; right-click and ⌘K-hold are desktop-only.</li>
              <li>Top bar shrinks: brand + project selector + search expand to a single row; chips move into a Settings sheet.</li>
            </ul>
          </div>
        </section>

        {/* Hook-up notes */}
        <section className="specimen__section">
          <h2>Hook-up notes for Claude Code</h2>
          <div className="specimen-card" style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>Every interactive element exposes a <code>data-callback</code> attribute for stable wiring. Components are pure presentational — wire <code>onSave</code>, <code>onSaveAndExtract</code>, etc. into your store or service layer.</p>
            <p style={{ margin: "0 0 8px" }}><strong>AppShell props:</strong> <code>brand, route, leftRailExpanded, rightRailExpanded, onSelectTab, onToggleLeftRail, onToggleRightRail, panels, onOpenPanel, onClosePanel, onPinPanel, onExpandPanel, onOpenCommandPalette, onOpenAdaptiveWheel, onRunWheelAction, onCloseAdaptiveWheel, onOpenReviewQueue, onOpenSettings, onSelectProject, onSelectBook, onTogglePrivacyMode, onUpdateBrandConfig</code></p>
            <p style={{ margin: "0 0 8px" }}><strong>LeftRail:</strong> <code>items, activeId, expanded, dropTargetId, onSelectTab</code>. Items: <code>{`{id, label, icon, group, entity?, queue?, soon?}`}</code>. Drag-target glow via <code>dropTargetId</code>; emits <code>onDropEntity(itemId, payload)</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>TopBar:</strong> <code>brand, project, view, onSetView, leftRailExpanded, onToggleLeftRail, privacyMode, onTogglePrivacyMode, syncState, globalQueueCount, selectedEntity, onOpenCommandPalette, onOpenSettings, onOpenProfile, onOpenReviewQueue, onSelectProject, onSelectBook</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>SlidingPanel:</strong> <code>panel, onClosePanel, onPinPanel, onExpandPanel, onOpenReviewQueue, onSelectEntity</code>. Panel object: <code>{`{id, kind, entityType, title, subtitle, state, pinned, expanded, rows?, selected?}`}</code>. State: <code>overview | selected | multi | empty | loading | error | review | edit | suggestion</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>RightUtilityRail:</strong> <code>expanded, queues, onOpenPanel, onOpenReviewQueue, onToggleExpanded</code>. Built-in slots: review, today, recent, refs, trash, notifs.</p>
            <p style={{ margin: "0 0 8px" }}><strong>BottomStatusStrip:</strong> <code>mode, lastSavedAt, isLocal, wordCount, reviewQueueCount, activeAuthor, extractionState, canvasZoom</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>CommandPalette:</strong> <code>open, onClose, onRunCommand</code>. Trigger: ⌘P / Ctrl+P.</p>
            <p style={{ margin: "0 0 8px" }}><strong>AdaptiveWheelHost:</strong> <code>open, x, y, contextLabel, onClose, onRunWheelAction</code>. Triggers (all wired): right-click, long-press (480ms), ⌘K-hold.</p>
            <p style={{ margin: "0 0 8px" }}><strong>EntityTypeBadge / ConfidenceBadge / ReviewCountBadge / PrivacyModeChip / SyncStateChip</strong> — props on the source files, all driven by the central <code>ENTITY_TYPES</code> / <code>CONFIDENCE</code> tables in <code>brand.jsx</code>.</p>
            <p style={{ margin: "0 0 8px" }}><strong>Future callbacks reserved:</strong> <code>onSaveAndDeepExtract, onCreateChapter, onReserveChapter, onDeleteChapterRequest, onConfirmDeleteChapter, onReorderChapter, onCreateCanvasNode, onConnectCanvasNodes, onUploadReference, onOpenRelatedTab</code>.</p>
          </div>
        </section>

      </div>
    </div>
  );
};

window.Specimen = Specimen;
