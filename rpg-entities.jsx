// =====================================================================
// rpg-entities.jsx
//
// Bespoke detail renderers + filter chips + richer sample data for the
// five RPG-style entity panels:
//
//   Items, Classes, Races, Stats, Abilities
//
// Wired into EntityTabShell via the `detailRender` and `filters` props
// (see entity-framework-host.jsx).
//
// Genre-neutral: vocabulary stays generic ("modifier", "affix",
// "trigger", "tier", "ability") so the panels work for any author.
//
// =====================================================================

const { useState: _us_rpg } = React;

// =====================================================================
// SHARED PRIMITIVES (used by every detail body)
// =====================================================================

// Card-like section with a title + optional action.
const RpgSection = ({ title, action, children }) => (
  <section className="rpg-section" data-ui="RpgSection">
    <header className="rpg-section__head">
      <span className="rpg-section__title">{title}</span>
      {action && (
        <button className="rpg-section__action"
                data-callback={action.callback}
                onClick={action.onClick}>{action.label}</button>
      )}
    </header>
    <div className="rpg-section__body">{children}</div>
  </section>
);

// Faceted top chips ("type / rarity / owner / status …")
const RpgFacets = ({ items }) => (
  <div className="rpg-facets">
    {items.filter(Boolean).map((f, i) => (
      <div key={i} className={"rpg-facet" + (f.tone ? " rpg-facet--" + f.tone : "")}>
        <span className="rpg-facet__k">{f.k}</span>
        <span className="rpg-facet__v">{f.v}</span>
      </div>
    ))}
  </div>
);

// Stat bar / chip with optional value + min/max.
const RpgStatChip = ({ name, value, min, max, kind = "number" }) => {
  const pct = (min != null && max != null && typeof value === "number")
    ? Math.max(0, Math.min(1, (value - min) / (max - min))) : null;
  return (
    <div className="rpg-stat" data-callback="onOpenStatHistory" data-stat={name}>
      <div className="rpg-stat__head">
        <span className="rpg-stat__name">{name}</span>
        <span className="rpg-stat__val">{value ?? "—"}</span>
      </div>
      {pct != null && (
        <div className="rpg-stat__bar"><span style={{ width: (pct * 100) + "%" }}/></div>
      )}
      {kind !== "number" && <div className="rpg-stat__kind">{kind}</div>}
    </div>
  );
};

// Chip row — clickable entity references.
const RpgChipRow = ({ items, onSelect, emptyLabel = "—" }) => {
  if (!items || items.length === 0) return <span className="rpg-empty">{emptyLabel}</span>;
  return (
    <div className="rpg-chiprow">
      {items.map((it, i) => (
        <button key={it.id || i} className={"rpg-chip" + (it.tone ? " rpg-chip--" + it.tone : "")}
                data-callback="onOpenRelatedTab"
                onClick={() => onSelect && onSelect(it)}
                title={it.title || it.label}>
          {it.type && <span className="rpg-chip__type">{it.typeGlyph || it.type[0].toUpperCase()}</span>}
          <span>{it.label || it.name}</span>
          {it.count != null && <span className="rpg-chip__n">{it.count}</span>}
        </button>
      ))}
    </div>
  );
};

// Chapter sparkline (re-used from existing mentionsByChapter shape)
const RpgChapterSpark = ({ mentions = [] }) => {
  if (!mentions.length) return <span className="rpg-empty">No mentions indexed.</span>;
  const max = Math.max(1, ...mentions);
  return (
    <div className="rpg-spark" role="img" aria-label="Mentions by chapter">
      {mentions.map((n, i) => (
        <span key={i} className="rpg-spark__col" title={"Ch. " + (i + 1) + " — " + n + " mention(s)"}>
          <span className="rpg-spark__bar" style={{ height: (8 + (n / max) * 32) + "px", opacity: n === 0 ? 0.15 : 1 }}/>
          <span className="rpg-spark__lbl">{i + 1}</span>
        </span>
      ))}
    </div>
  );
};

// Mini key-value grid.
const RpgKV = ({ rows }) => (
  <div className="rpg-kv">
    {rows.map((r, i) => (
      <React.Fragment key={i}>
        <div className="rpg-kv__k">{r[0]}</div>
        <div className="rpg-kv__v">{r[1]}</div>
      </React.Fragment>
    ))}
  </div>
);

// =====================================================================
// ITEMS — bespoke detail body
// =====================================================================

const ITEM_RARITY_TONES = {
  "Common":     "neutral",
  "Uncommon":   "good",
  "Rare":       "route",
  "Heirloom":   "warn",
  "Legendary":  "danger",
  "Cursed":     "danger",
};

const ItemDetail = ({ entity, onSelectEntity, onOpenRelatedTab, onOpenSourceMention }) => {
  const e = entity || {};
  const owner       = e.currentOwner || (e.ownership && e.ownership[e.ownership.length - 1]);
  const ownership   = e.ownership   || [];
  const modifiers   = e.modifiers   || [];
  const affixes     = e.affixes     || [];
  const effects     = e.effects     || [];
  const equipped    = e.equipped    || [];
  const trades      = e.trades      || [];
  const upgrades    = e.upgrades    || [];
  const quests      = e.quests      || [];
  const events      = e.events      || [];
  const sites       = e.sites       || {};   // { found, used: [], lost }
  return (
    <div className="rpg-detail" data-ui="ItemDetail" data-entity-id={e.id} data-entity-type="items">
      <RpgFacets items={[
        { k: "Type",   v: e.itemType || "—" },
        { k: "Rarity", v: e.rarity || "Common", tone: ITEM_RARITY_TONES[e.rarity] || "neutral" },
        { k: "Status", v: e.status || "Active" },
        { k: "Owner",  v: owner ? (owner.name || owner) : "Unclaimed" },
        e.slot   ? { k: "Slot",   v: e.slot   } : null,
        e.weight ? { k: "Weight", v: e.weight } : null,
        e.first  ? { k: "First seen", v: e.first } : null,
      ]}/>

      {e.summary && (
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {(modifiers.length > 0 || affixes.length > 0) && (
        <RpgSection title="Modifiers & affixes" action={{ label: "+ Add modifier", callback: "onAddItemModifier" }}>
          <table className="rpg-table">
            <tbody>
              {modifiers.map((m, i) => (
                <tr key={"m" + i}>
                  <th>{m.target}</th>
                  <td className={"rpg-table__op rpg-table__op--" + (m.delta > 0 ? "up" : m.delta < 0 ? "down" : "flat")}>
                    {m.delta > 0 ? "+" + m.delta : m.delta}
                  </td>
                  <td>{m.note || ""}</td>
                </tr>
              ))}
              {affixes.map((a, i) => (
                <tr key={"a" + i}>
                  <th>{a.name}</th>
                  <td className="rpg-table__op rpg-table__op--flat">affix</td>
                  <td>{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </RpgSection>
      )}

      {effects.length > 0 && (
        <RpgSection title="Triggered effects" action={{ label: "+ Add effect", callback: "onAddItemEffect" }}>
          <div className="rpg-effects">
            {effects.map((f, i) => (
              <div key={i} className="rpg-effect">
                <div className="rpg-effect__trig">{f.trigger}</div>
                <div className="rpg-effect__arrow">→</div>
                <div className="rpg-effect__body">{f.effect}</div>
                {f.cost && <div className="rpg-effect__cost">{f.cost}</div>}
              </div>
            ))}
          </div>
        </RpgSection>
      )}

      {(sites.found || (sites.used && sites.used.length) || sites.lost) && (
        <RpgSection title="Locations" action={{ label: "Show on Atlas →", callback: "onShowItemOnAtlas" }}>
          <div className="rpg-sites">
            <div className="rpg-site rpg-site--found">
              <span className="rpg-site__lbl">Found</span>
              <span className="rpg-site__v">{sites.found?.name || "—"}</span>
              {sites.found?.cite && <span className="rpg-site__cite">{sites.found.cite}</span>}
            </div>
            <div className="rpg-site rpg-site--used">
              <span className="rpg-site__lbl">Used</span>
              <span className="rpg-site__v">
                {sites.used?.length ? sites.used.map((u) => u.name).join(", ") : "—"}
              </span>
            </div>
            <div className="rpg-site rpg-site--lost">
              <span className="rpg-site__lbl">Lost</span>
              <span className="rpg-site__v">{sites.lost?.name || "—"}</span>
              {sites.lost?.cite && <span className="rpg-site__cite">{sites.lost.cite}</span>}
            </div>
          </div>
        </RpgSection>
      )}

      {(ownership.length > 0 || equipped.length > 0 || trades.length > 0 || upgrades.length > 0) && (
        <RpgSection title="History">
          <ul className="rpg-history">
            {[...ownership.map((o) => ({ ...o, kind: "ownership" })),
              ...equipped.map((o) => ({ ...o, kind: "equipped" })),
              ...trades.map((o) => ({ ...o, kind: "trade" })),
              ...upgrades.map((o) => ({ ...o, kind: "upgrade" }))]
              .sort((a, b) => (a.chapter || 0) - (b.chapter || 0))
              .map((h, i) => (
                <li key={i} className={"rpg-history__row rpg-history__row--" + h.kind}>
                  <span className="rpg-history__chap">Ch. {h.chapter ?? "—"}</span>
                  <span className="rpg-history__kind">{h.kind}</span>
                  <span className="rpg-history__what">{h.what}</span>
                  {h.cite && (
                    <button className="rpg-history__cite" data-callback="onOpenSourceMention"
                            onClick={() => onOpenSourceMention && onOpenSourceMention(h)}>
                      {h.cite}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </RpgSection>
      )}

      {(quests.length > 0 || events.length > 0) && (
        <RpgSection title="Quest & event links">
          <RpgChipRow items={[...quests, ...events]} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {e.mentionsByChapter && (
        <RpgSection title="Chapter appearances">
          <RpgChapterSpark mentions={e.mentionsByChapter}/>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAssignItemOwner">Assign owner</button>
        <button className="rpg-btn" data-callback="onEquipItem">Equip</button>
        <button className="rpg-btn" data-callback="onUnequipItem">Unequip</button>
        <button className="rpg-btn" data-callback="onTradeItem">Trade…</button>
        <button className="rpg-btn" data-callback="onUpgradeItem">Upgrade…</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onDropItem">Drop</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onDestroyItem">Destroy</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onShowItemOnAtlas">Show on Atlas</button>
      </div>
    </div>
  );
};

// =====================================================================
// CLASSES — bespoke detail body
// =====================================================================

const ClassDetail = ({ entity, onSelectEntity }) => {
  const e = entity || {};
  return (
    <div className="rpg-detail" data-ui="ClassDetail" data-entity-id={e.id} data-entity-type="classes">
      <RpgFacets items={[
        { k: "Category", v: e.category || "Generic" },
        { k: "Role",     v: e.role || "—" },
        { k: "Members",  v: (e.examples && e.examples.length) || 0 },
        e.first ? { k: "First seen", v: e.first } : null,
      ]}/>

      {e.summary && (
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {e.defaultStats && (
        <RpgSection title="Default stats">
          <div className="rpg-statgrid">
            {e.defaultStats.map((s) => (
              <RpgStatChip key={s.name} {...s}/>
            ))}
          </div>
        </RpgSection>
      )}

      {e.allowedAbilities && e.allowedAbilities.length > 0 && (
        <RpgSection title="Allowed abilities" action={{ label: "+ Link ability", callback: "onLinkClassAbility" }}>
          <RpgChipRow items={e.allowedAbilities} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {e.skillTrees && e.skillTrees.length > 0 && (
        <RpgSection title="Skill trees" action={{ label: "+ Link skill tree", callback: "onLinkClassSkillTree" }}>
          <RpgChipRow items={e.skillTrees} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.restrictions || []).length > 0 && (
        <RpgSection title="Restrictions">
          <ul className="rpg-bullets">
            {e.restrictions.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </RpgSection>
      )}

      {(e.typicalRoles || []).length > 0 && (
        <RpgSection title="Typical roles">
          <div className="rpg-tags">
            {e.typicalRoles.map((r, i) => <span key={i} className="rpg-tag">{r}</span>)}
          </div>
        </RpgSection>
      )}

      {(e.examples || []).length > 0 && (
        <RpgSection title="Example characters" action={{ label: "Show all →", callback: "onShowClassCharacters" }}>
          <RpgChipRow items={e.examples} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAssignClass">Assign to character</button>
        <button className="rpg-btn" data-callback="onEditClass">Edit</button>
        <button className="rpg-btn" data-callback="onDuplicateClass">Duplicate</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onDeleteClass">Delete</button>
      </div>
    </div>
  );
};

// =====================================================================
// RACES / SPECIES — bespoke detail body
// =====================================================================

const RaceDetail = ({ entity, onSelectEntity }) => {
  const e = entity || {};
  return (
    <div className="rpg-detail" data-ui="RaceDetail" data-entity-id={e.id} data-entity-type="races">
      <RpgFacets items={[
        { k: "Category", v: e.category || "Folk" },
        { k: "Members",  v: (e.examples && e.examples.length) || 0 },
        e.origin ? { k: "Origin", v: e.origin.name || e.origin } : null,
        e.first ? { k: "First seen", v: e.first } : null,
      ]}/>

      {e.summary && (
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {(e.traits || []).length > 0 && (
        <RpgSection title="Traits">
          <ul className="rpg-bullets">
            {e.traits.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </RpgSection>
      )}

      {e.defaultStats && (
        <RpgSection title="Default stats">
          <div className="rpg-statgrid">
            {e.defaultStats.map((s) => <RpgStatChip key={s.name} {...s}/>)}
          </div>
        </RpgSection>
      )}

      {(e.abilities || []).length > 0 && (
        <RpgSection title="Innate abilities" action={{ label: "+ Link ability", callback: "onLinkRaceAbility" }}>
          <RpgChipRow items={e.abilities} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {e.cultureNotes && (
        <RpgSection title="Culture notes">
          <p className="rpg-prose rpg-prose--ital">{e.cultureNotes}</p>
        </RpgSection>
      )}

      {(e.originLocations || []).length > 0 && (
        <RpgSection title="Origin locations" action={{ label: "Show on Atlas →", callback: "onShowRaceOnAtlas" }}>
          <RpgChipRow items={e.originLocations} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.factions || []).length > 0 && (
        <RpgSection title="Faction links" action={{ label: "+ Link faction", callback: "onLinkRaceFaction" }}>
          <RpgChipRow items={e.factions} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.bestiaryLinks || []).length > 0 && (
        <RpgSection title="Related bestiary entries" action={{ label: "+ Link bestiary", callback: "onLinkRaceBestiary" }}>
          <RpgChipRow items={e.bestiaryLinks} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.examples || []).length > 0 && (
        <RpgSection title="Example characters">
          <RpgChipRow items={e.examples} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAssignRace">Assign to character</button>
        <button className="rpg-btn" data-callback="onEditRace">Edit</button>
        <button className="rpg-btn" data-callback="onDuplicateRace">Duplicate</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onShowRaceOnAtlas">Show on Atlas</button>
      </div>
    </div>
  );
};

// =====================================================================
// STATS — bespoke detail body
// =====================================================================

const StatDetail = ({ entity, onSelectEntity, onOpenSourceMention }) => {
  const e = entity || {};
  const history = e.history || [];
  const rules   = e.extractionRules || [];
  return (
    <div className="rpg-detail" data-ui="StatDetail" data-entity-id={e.id} data-entity-type="stats">
      <RpgFacets items={[
        { k: "Value type", v: e.valueType || "number" },
        { k: "Default",    v: e.defaultValue ?? "—" },
        e.min != null ? { k: "Min", v: e.min } : null,
        e.max != null ? { k: "Max", v: e.max } : null,
        { k: "Used by", v: (e.usedByCharacters && e.usedByCharacters.length) || 0 },
      ]}/>

      {e.summary && (
        <RpgSection title="Description">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      <RpgSection title="Extraction phrase rules"
                  action={{ label: "+ Add rule", callback: "onAddStatChangeRule" }}>
        <table className="rpg-rules">
          <thead>
            <tr><th>Phrase shape</th><th>Treated as</th><th>Needs review?</th></tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr><td colSpan={3} className="rpg-empty">No rules defined. Add one to teach extraction how to parse stat changes.</td></tr>
            )}
            {rules.map((r, i) => (
              <tr key={i}>
                <td className="rpg-rules__phrase"><code>{r.phrase}</code></td>
                <td className={"rpg-rules__op rpg-rules__op--" + (r.kind === "exact" ? "exact" : r.kind === "decrease" ? "down" : "qual")}>{r.treatedAs}</td>
                <td className="rpg-rules__rev">{r.review ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </RpgSection>

      {history.length > 0 && (
        <RpgSection title="Recent stat changes">
          <ul className="rpg-history">
            {history.map((h, i) => (
              <li key={i} className={"rpg-history__row rpg-history__row--" + (h.delta > 0 ? "up" : h.delta < 0 ? "down" : "qual")}>
                <span className="rpg-history__chap">Ch. {h.chapter}</span>
                <span className="rpg-history__what">
                  <b>{h.subject}</b> {h.delta > 0 ? "+" + h.delta : h.delta != null ? h.delta : h.qualitative}
                </span>
                {h.cite && (
                  <button className="rpg-history__cite" data-callback="onOpenSourceMention"
                          onClick={() => onOpenSourceMention && onOpenSourceMention(h)}>
                    {h.cite}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.linkedAbilities || []).length > 0 && (
        <RpgSection title="Related abilities">
          <RpgChipRow items={e.linkedAbilities} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.usedByCharacters || []).length > 0 && (
        <RpgSection title="Characters using stat" action={{ label: "View all →", callback: "onOpenStatHistory" }}>
          <RpgChipRow items={e.usedByCharacters} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.itemsAffecting || []).length > 0 && (
        <RpgSection title="Items affecting stat">
          <RpgChipRow items={e.itemsAffecting} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAssignStat">Add to character</button>
        <button className="rpg-btn" data-callback="onUpdateStatValue">Set value</button>
        <button className="rpg-btn" data-callback="onUpdateStatValue">Increase</button>
        <button className="rpg-btn" data-callback="onUpdateStatValue">Decrease</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenStatHistory">View history</button>
      </div>
    </div>
  );
};

// =====================================================================
// ABILITIES — bespoke detail body
// =====================================================================

const ABILITY_TYPE_TONES = {
  active:    "route",
  passive:   "neutral",
  "one-time":"warn",
  triggered: "good",
  inherited: "neutral",
  temporary: "warn",
};

const AbilityDetail = ({ entity, onSelectEntity, onOpenSourceMention }) => {
  const e = entity || {};
  const upgrades = e.upgradePath || [];
  const usage    = e.usageHistory || [];
  return (
    <div className="rpg-detail" data-ui="AbilityDetail" data-entity-id={e.id} data-entity-type="abilities">
      <RpgFacets items={[
        { k: "Type",      v: e.abilityType || "active", tone: ABILITY_TYPE_TONES[e.abilityType] || "neutral" },
        e.cost      ? { k: "Cost",      v: e.cost      } : null,
        e.cooldown  ? { k: "Cooldown",  v: e.cooldown  } : null,
        e.limit     ? { k: "Limit",     v: e.limit     } : null,
        { k: "Used by", v: (e.characters || []).length },
      ]}/>

      {e.summary && (
        <RpgSection title="Description">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {(e.requirements || []).length > 0 && (
        <RpgSection title="Requirements">
          <ul className="rpg-bullets">
            {e.requirements.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </RpgSection>
      )}

      {(e.effects || []).length > 0 && (
        <RpgSection title="Effects">
          <div className="rpg-effects">
            {e.effects.map((f, i) => (
              <div key={i} className="rpg-effect">
                <div className="rpg-effect__trig">{f.trigger || "On use"}</div>
                <div className="rpg-effect__arrow">→</div>
                <div className="rpg-effect__body">{f.effect}</div>
                {f.cost && <div className="rpg-effect__cost">{f.cost}</div>}
              </div>
            ))}
          </div>
        </RpgSection>
      )}

      {upgrades.length > 0 && (
        <RpgSection title="Upgrade path" action={{ label: "+ Add tier", callback: "onUpgradeAbility" }}>
          <ol className="rpg-upgrades">
            {upgrades.map((u, i) => (
              <li key={i} className={"rpg-upgrade" + (u.unlocked ? " is-unlocked" : "")}>
                <span className="rpg-upgrade__t">{u.tier || ("Tier " + (i + 1))}</span>
                <span className="rpg-upgrade__name">{u.name}</span>
                <span className="rpg-upgrade__desc">{u.effect}</span>
              </li>
            ))}
          </ol>
        </RpgSection>
      )}

      {(e.linkedStats || []).length > 0 && (
        <RpgSection title="Linked stats">
          <RpgChipRow items={e.linkedStats} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.linkedClasses || e.linkedRaces) && ((e.linkedClasses || []).length > 0 || (e.linkedRaces || []).length > 0) && (
        <RpgSection title="Linked class & race">
          <RpgChipRow items={[...(e.linkedClasses || []), ...(e.linkedRaces || [])]} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.skillTreeNodes || []).length > 0 && (
        <RpgSection title="Skill tree nodes" action={{ label: "+ Link to skill tree", callback: "onLinkAbilityToSkillTree" }}>
          <RpgChipRow items={e.skillTreeNodes} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.characters || []).length > 0 && (
        <RpgSection title="Characters with this ability">
          <RpgChipRow items={e.characters} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {usage.length > 0 && (
        <RpgSection title="Usage history" action={{ label: "Show all →", callback: "onOpenAbilityUsageHistory" }}>
          <ul className="rpg-history">
            {usage.map((u, i) => (
              <li key={i} className="rpg-history__row rpg-history__row--usage">
                <span className="rpg-history__chap">Ch. {u.chapter}</span>
                <span className="rpg-history__what"><b>{u.who}</b> — {u.what}</span>
                {u.cite && (
                  <button className="rpg-history__cite" data-callback="onOpenSourceMention"
                          onClick={() => onOpenSourceMention && onOpenSourceMention(u)}>
                    {u.cite}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAssignAbility">Assign to character</button>
        <button className="rpg-btn" data-callback="onUpgradeAbility">Upgrade</button>
        <button className="rpg-btn" data-callback="onLinkAbilityToSkillTree">Link to skill tree</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenAbilityUsageHistory">Usage history</button>
      </div>
    </div>
  );
};

// =====================================================================
// SAMPLE DATA OVERRIDES
//
// Merge richer per-type entity records into window.ENTITY_SAMPLES.
// Genre-neutral wording. Anchored in the existing Pale Reach / Hess
// manuscript so it stays cohesive with Cast/Atlas/Bestiary data.
// =====================================================================

const RPG_ITEM_DATA = [
  {
    id: "i1", type: "items", name: "Bone Auger", glyphChar: "Ba", status: "active",
    subtitle: "Heirloom drilling-blade",
    summary: "A whale-bone drilling tool turned heirloom regalia. Pivotal at the Ch. 1 wake and the Ch. 7 break.",
    itemType: "Weapon · Tool",
    rarity: "Heirloom",
    slot: "Two-handed",
    weight: "3.4 lb",
    first: "Ch. 1, p. 12",
    chapterRange: "Ch. 1–7", queue: 1,
    mentionsByChapter: [4,2,0,1,0,1,3,0,0,0,0,0],
    currentOwner: { id: "c1", type: "cast", name: "Aelinor Vey" },
    modifiers: [
      { target: "Resolve", delta: +2, note: "Carrier rolls with the rite's gravity." },
      { target: "Cunning", delta: -1, note: "Visible weight — never the right answer for a quiet room." },
    ],
    affixes: [
      { name: "Salt-bitten",     note: "Cannot be sundered by ordinary edge." },
      { name: "Auger-keyed",     note: "Only an Auger-keeper may swing it without pain." },
    ],
    effects: [
      { trigger: "On strike vs. stone", effect: "Bores three palm-deep before the haft chips" },
      { trigger: "On full moon",        effect: "Rings audibly for the carrier",     cost: "—" },
    ],
    ownership: [
      { chapter: 1, what: "Inherited by Aelinor at the wake",    cite: "Ch. 1, p. 12" },
      { chapter: 7, what: "Loaned to Captain Brec for the break",cite: "Ch. 7, p. 188" },
    ],
    equipped: [
      { chapter: 1, what: "Aelinor wears it openly for the rite", cite: "Ch. 1, p. 14" },
      { chapter: 7, what: "Brec carries it under his cloak",      cite: "Ch. 7, p. 191" },
    ],
    upgrades: [
      { chapter: 4, what: "Haft re-bound after Vraska stress",    cite: "Ch. 4, p. 96" },
    ],
    quests: [{ id: "q1", type: "quests", label: "The Auger Wake" }],
    events: [{ id: "e1", type: "events", label: "Hess negotiation break" }],
    sites: {
      found: { id: "rk", name: "Reachstone Keep · Vault",        cite: "Ch. 1, p. 11" },
      used:  [{ id: "pr", name: "Pale Reach Hold" }, { id: "vp", name: "Vraska Pass" }, { id: "gc", name: "Glass Court" }],
      lost:  null,
    },
  },
  {
    id: "i2", type: "items", name: "Vey Signet", glyphChar: "Vs", status: "active",
    subtitle: "Worn since coronation",
    summary: "Sealing ring of House Vey. Never removed in public.",
    itemType: "Trinket · Seal",
    rarity: "Rare",
    slot: "Finger",
    weight: "0.2 oz",
    first: "Ch. 1, p. 10",
    chapterRange: "Ch. 1–7",
    currentOwner: { id: "c1", type: "cast", name: "Aelinor Vey" },
    modifiers: [{ target: "Standing", delta: +3, note: "House recognition." }],
    affixes:   [{ name: "Sealing wax", note: "Marks any letter as Vey-bound." }],
    mentionsByChapter: [3,1,2,1,1,2,2,0,0,0,0,0],
    sites: { found: { name: "Pre-story" }, used: [{ name: "Pale Reach Hold" }, { name: "Glass Court" }], lost: null },
    quests: [], events: [],
  },
  {
    id: "i3", type: "items", name: "Salt-bitten Cloak", glyphChar: "Sc", status: "active",
    subtitle: "Found on Brec — but not Brec's",
    summary: "A heavy cloak salt-burned along the hem; ownership is the open question of Ch. 5.",
    itemType: "Apparel · Cloak",
    rarity: "Uncommon",
    slot: "Outerwear",
    first: "Ch. 5, p. 122",
    queue: 1, queueLevel: "weak",
    chapterRange: "Ch. 5–7",
    currentOwner: null,
    modifiers: [{ target: "Stealth", delta: +1, note: "Reads as dock-worker at distance." }],
    affixes:   [{ name: "Pre-owned", note: "Whose, exactly, is the chapter's question." }],
    mentionsByChapter: [0,0,0,0,3,1,1,0,0,0,0,0],
    sites: {
      found: { id: "vp", name: "Vraska Pass · roadside",  cite: "Ch. 5, p. 122" },
      used:  [{ name: "Vraska road" }],
      lost:  null,
    },
    quests: [], events: [],
    trades: [{ chapter: 5, what: "Pulled from a roadside body", cite: "Ch. 5, p. 122" }],
  },
  {
    id: "i4", type: "items", name: "Hess Letter-key", glyphChar: "Hk", status: "lost",
    subtitle: "Letter-locking key, dropped in Ch. 5",
    summary: "Folding key Brec used to seal his Ch. 2–5 letters. Lost in the Brittlewood track.",
    itemType: "Tool · Cipher",
    rarity: "Rare",
    first: "Ch. 2, p. 32",
    chapterRange: "Ch. 2–5",
    currentOwner: null,
    mentionsByChapter: [0,2,1,1,3,0,0,0,0,0,0,0],
    affixes: [{ name: "Single-handed fold", note: "Sealed papers only the recipient can open whole." }],
    sites: {
      found: { id: "wd", name: "Watchhouse, Pale Reach Hold", cite: "Ch. 2, p. 32" },
      used:  [{ name: "Brec's room" }, { name: "Vraska road" }],
      lost:  { id: "bw", name: "Brittlewood",                 cite: "Ch. 5, p. 134" },
    },
    quests: [{ id: "q2", type: "quests", label: "Brec's Letter" }],
    events: [],
  },
];

const RPG_CLASS_DATA = [
  {
    id: "cl1", type: "classes", name: "Salt-bearer", glyphChar: "Sb", status: "active",
    subtitle: "Reach functionary class",
    summary: "Bonded officials of the Pale Reach taught to walk the salted causeways without harm. Visible badge of office is the salt-glazed collar.",
    category: "Functionary",
    role: "Support / civic",
    first: "Ch. 2, p. 38",
    chapterRange: "Ch. 2–7",
    mentionsByChapter: [0,3,1,0,2,1,2,0,0,0,0,0],
    defaultStats: [
      { name: "Resolve", value: 12, min: 1, max: 20 },
      { name: "Cunning", value: 9,  min: 1, max: 20 },
      { name: "Stewardship", value: 14, min: 1, max: 20 },
    ],
    allowedAbilities: [
      { id: "ab2", type: "abilities", label: "Letter-locking" },
      { id: "ab3", type: "abilities", label: "Causeway walk" },
    ],
    skillTrees: [{ id: "sk2", type: "skills", label: "Statecraft tree" }],
    restrictions: ["May not bear edged weapons during rites.", "Forbidden from House Hess audience without escort."],
    typicalRoles: ["Granary keeper", "Watch clerk", "Tide-officer"],
    examples: [
      { id: "c3", type: "cast", label: "Captain Brec" },
      { id: "c6", type: "cast", label: "Dav the Quiet" },
    ],
  },
  {
    id: "cl2", type: "classes", name: "Auger-keeper", glyphChar: "Ak", status: "active",
    subtitle: "Inheritor of the Bone Auger",
    summary: "Hereditary bearer of the Bone Auger and the rites built around it.",
    category: "Hereditary",
    role: "Symbolic / lead",
    first: "Ch. 1, p. 8",
    chapterRange: "Ch. 1–7", queue: 1,
    mentionsByChapter: [2,0,0,0,0,0,2,0,0,0,0,0],
    defaultStats: [
      { name: "Resolve",  value: 16, min: 1, max: 20 },
      { name: "Standing", value: 18, min: 1, max: 20 },
    ],
    allowedAbilities: [{ id: "ab1", type: "abilities", label: "Court tongue" }],
    skillTrees: [{ id: "sk1", type: "skills", label: "Diplomacy tree" }],
    restrictions: ["Only one living Auger-keeper at a time."],
    typicalRoles: ["Rite-leader", "House heir"],
    examples: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
  },
  {
    id: "cl3", type: "classes", name: "Letter-walker", glyphChar: "Lw", status: "active",
    subtitle: "Itinerant courier-cryptographer",
    summary: "Couriers trained to compose and read sealed letters across hostile lines.",
    category: "Itinerant",
    role: "Skirmisher / support",
    first: "Ch. 5, p. 122",
    chapterRange: "Ch. 5",
    mentionsByChapter: [0,0,0,0,2,0,0,0,0,0,0,0],
    defaultStats: [
      { name: "Cunning",  value: 14, min: 1, max: 20 },
      { name: "Speed",    value: 13, min: 1, max: 20 },
    ],
    allowedAbilities: [{ id: "ab2", type: "abilities", label: "Letter-locking" }],
    skillTrees: [],
    restrictions: ["Sworn never to break their own seals."],
    typicalRoles: ["Diplomatic courier", "Spy"],
    examples: [],
  },
];

const RPG_RACE_DATA = [
  {
    id: "r1", type: "races", name: "Reach-folk", glyphChar: "Rf", status: "active",
    subtitle: "Salt-cold coastal people",
    summary: "Hardy people of the Pale Reach; weather-tested, plain-spoken. Bound to the salt-cold by long habit.",
    category: "Folk",
    first: "Ch. 1, p. 4",
    chapterRange: "Ch. 1–7",
    mentionsByChapter: [3,1,2,1,1,2,1,0,0,0,0,0],
    traits: [
      "Cold-acclimated — no penalty in the salt-cold.",
      "Saltsense — can taste fresh from sour at a sip.",
      "Plain-spoken — Cunning is harder to raise above 12.",
    ],
    defaultStats: [
      { name: "Resolve",  value: 13, min: 1, max: 20 },
      { name: "Cunning",  value: 9,  min: 1, max: 20 },
      { name: "Compassion", value: 11, min: 1, max: 20 },
    ],
    abilities: [
      { id: "ab3", type: "abilities", label: "Causeway walk" },
    ],
    cultureNotes: "Reach-folk count years by storms, not summers. A 'mild year' is one where less than three boats are lost.",
    originLocations: [
      { id: "a1", type: "locations", label: "Pale Reach" },
      { id: "sw", type: "locations", label: "Salt Watch" },
    ],
    factions: [{ id: "f1", type: "factions", label: "House Vey" }],
    bestiaryLinks: [{ id: "b3", type: "bestiary", label: "Hess gull" }],
    examples: [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c3", type: "cast", label: "Captain Brec" },
    ],
  },
  {
    id: "r2", type: "races", name: "Hess-born", glyphChar: "Hb", status: "active",
    subtitle: "Of House Hess and the Glass Court",
    summary: "Inland people of Hessmark; trained on archives and on the Court's measured speech.",
    category: "Folk",
    first: "Ch. 3, p. 76",
    chapterRange: "Ch. 3–7",
    mentionsByChapter: [0,0,2,0,0,0,2,0,0,0,0,0],
    traits: ["Lettered — bonus on Court tongue rolls.", "Slow to warm — Compassion is harder to raise above 12."],
    defaultStats: [
      { name: "Cunning",   value: 13, min: 1, max: 20 },
      { name: "Standing",  value: 12, min: 1, max: 20 },
    ],
    abilities: [{ id: "ab1", type: "abilities", label: "Court tongue" }],
    cultureNotes: "Hess-born keep ledgers as other peoples keep histories. To be 'in the book' is more permanent than to be in a song.",
    originLocations: [{ id: "gc", type: "locations", label: "Glass Court" }],
    factions: [{ id: "f2", type: "factions", label: "House Hess" }],
    examples: [
      { id: "c2", type: "cast", label: "Saren of Hess" },
      { id: "c5", type: "cast", label: "Mara of Hess" },
    ],
  },
];

const RPG_STAT_DATA = [
  {
    id: "s1", type: "stats", name: "Resolve", glyphChar: "Re", status: "active",
    subtitle: "How long a will holds in the cold",
    summary: "How far a character will go before they fold. Used in Cast and Faction sheets; gates several Ch. 7 outcomes.",
    valueType: "number", defaultValue: 10, min: 1, max: 20,
    chapterRange: "Ch. 1–7",
    mentionsByChapter: [1,0,1,0,2,1,3,0,0,0,0,0],
    extractionRules: [
      { phrase: "resolve increased by +N", treatedAs: "Exact +N",          kind: "exact",    review: false },
      { phrase: "held the line",            treatedAs: "Qualitative +1",   kind: "qual",     review: true  },
      { phrase: "could not bear it",        treatedAs: "Qualitative −1",   kind: "decrease", review: true  },
    ],
    history: [
      { chapter: 1, subject: "Aelinor Vey",  delta: +1,        cite: "Ch. 1, p. 14" },
      { chapter: 5, subject: "Captain Brec", qualitative: "held the line", cite: "Ch. 5, p. 122" },
      { chapter: 7, subject: "Aelinor Vey",  delta: -2,        cite: "Ch. 7, p. 188" },
    ],
    linkedAbilities:   [{ id: "ab1", type: "abilities", label: "Court tongue" }],
    usedByCharacters:  [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c3", type: "cast", label: "Captain Brec" },
    ],
    itemsAffecting:    [{ id: "i1", type: "items", label: "Bone Auger" }],
  },
  {
    id: "s2", type: "stats", name: "Cunning", glyphChar: "Cu", status: "active",
    subtitle: "Reading the room before it is read",
    summary: "Awareness, manipulation, and the patience to wait for the right moment.",
    valueType: "number", defaultValue: 10, min: 1, max: 20,
    extractionRules: [
      { phrase: "cunning increased by +N", treatedAs: "Exact +N",        kind: "exact", review: false },
      { phrase: "saw it before any",       treatedAs: "Qualitative +1", kind: "qual",  review: true },
    ],
    history: [{ chapter: 3, subject: "Saren of Hess", delta: +1, cite: "Ch. 3, p. 80" }],
    linkedAbilities:   [{ id: "ab1", type: "abilities", label: "Court tongue" }],
    usedByCharacters:  [{ id: "c2", type: "cast", label: "Saren of Hess" }],
  },
  {
    id: "s3", type: "stats", name: "Compassion", glyphChar: "Co", status: "active",
    subtitle: "Choosing kindness when costly",
    summary: "How willing the character is to take the harder, kinder choice.",
    valueType: "number", defaultValue: 10, min: 1, max: 20,
    extractionRules: [
      { phrase: "stayed her hand", treatedAs: "Qualitative +1", kind: "qual", review: true },
    ],
    history: [{ chapter: 6, subject: "Aelinor Vey", qualitative: "stayed her hand", cite: "Ch. 6, p. 168" }],
    linkedAbilities: [],
    usedByCharacters: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
  },
  {
    id: "s4", type: "stats", name: "Standing", glyphChar: "St", status: "active",
    subtitle: "Public weight; varies by room",
    summary: "Qualitative weight in court. Tracked as a label, not a number.",
    valueType: "scale", defaultValue: "House-recognized",
    extractionRules: [
      { phrase: "received without escort",  treatedAs: "Standing → Court-recognized",   kind: "qual", review: true },
      { phrase: "named in the ledger",       treatedAs: "Standing → House-recognized",  kind: "exact", review: false },
    ],
    history: [
      { chapter: 1, subject: "Aelinor Vey",  qualitative: "House-recognized" },
      { chapter: 3, subject: "Aelinor Vey",  qualitative: "Court-recognized",     cite: "Ch. 3, p. 78" },
    ],
    usedByCharacters: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
  },
];

const RPG_ABILITY_DATA = [
  {
    id: "ab1", type: "abilities", name: "Court tongue", glyphChar: "Ct", status: "active",
    subtitle: "Read a room before a room knows it is read",
    summary: "A learned ability; the trained ear for which silences mean which next words. House-tutored, not innate.",
    abilityType: "passive",
    cost: "—",
    cooldown: "None",
    limit: "Only in language one understands",
    first: "Ch. 1, p. 14",
    chapterRange: "Ch. 1, 3, 7",
    mentionsByChapter: [2,0,2,0,0,0,3,0,0,0,0,0],
    requirements: ["Standing ≥ House-recognized", "Cunning ≥ 12"],
    effects: [
      { trigger: "On entering a populated room", effect: "Note one undeclared stance per character" },
      { trigger: "On overhearing",                effect: "Reroll one Cunning check per scene" },
    ],
    upgradePath: [
      { tier: "Tier I",   name: "Listen",       effect: "Note one undeclared stance per scene",          unlocked: true  },
      { tier: "Tier II",  name: "Hold the floor",effect: "Reroll one Cunning check per scene",            unlocked: true  },
      { tier: "Tier III", name: "Bind a treaty", effect: "Spend a Standing point to silence a counter-claim", unlocked: false },
    ],
    linkedStats:    [{ id: "s2", type: "stats", label: "Cunning" }, { id: "s4", type: "stats", label: "Standing" }],
    linkedClasses:  [{ id: "cl2", type: "classes", label: "Auger-keeper" }],
    linkedRaces:    [{ id: "r2",  type: "races",   label: "Hess-born"   }],
    skillTreeNodes: [{ id: "sk1", type: "skills",  label: "Diplomacy tree → Listen node" }],
    characters:     [{ id: "c1", type: "cast", label: "Aelinor Vey" }, { id: "c2", type: "cast", label: "Saren of Hess" }],
    usageHistory: [
      { chapter: 3, who: "Aelinor", what: "Counted Saren's three unspoken concessions", cite: "Ch. 3, p. 80" },
      { chapter: 7, who: "Saren",   what: "Held the floor through the negotiation break", cite: "Ch. 7, p. 188" },
    ],
  },
  {
    id: "ab2", type: "abilities", name: "Letter-locking", glyphChar: "Ll", status: "active",
    subtitle: "Folds papers no eye but the recipient may open whole",
    summary: "A trained fold-and-seal that destroys the page on tampering. Letter-walker classic.",
    abilityType: "active",
    cost: "1 paper, 1 minute",
    cooldown: "None",
    limit: "Single sheet per lock",
    first: "Ch. 5, p. 134",
    chapterRange: "Ch. 5", queue: 1,
    mentionsByChapter: [0,0,0,0,3,0,0,0,0,0,0,0],
    requirements: ["Hess Letter-key in possession"],
    effects: [
      { trigger: "On seal",     effect: "Letter is unreadable until opened whole by recipient" },
      { trigger: "On tampering",effect: "Page tears at the seam; contents are destroyed" },
    ],
    upgradePath: [
      { tier: "Tier I",  name: "Single lock", effect: "Seal a single sheet", unlocked: true },
      { tier: "Tier II", name: "Triple lock", effect: "Seal three sheets in one fold", unlocked: false },
    ],
    linkedStats:    [{ id: "s2", type: "stats", label: "Cunning" }],
    linkedClasses:  [{ id: "cl3", type: "classes", label: "Letter-walker" }],
    skillTreeNodes: [],
    characters:     [{ id: "c3", type: "cast", label: "Captain Brec" }],
    usageHistory: [
      { chapter: 5, who: "Brec", what: "Sealed the Brittlewood letter", cite: "Ch. 5, p. 134" },
    ],
  },
  {
    id: "ab3", type: "abilities", name: "Causeway walk", glyphChar: "Cw", status: "active",
    subtitle: "Walk the salted causeways without harm",
    summary: "Reach-folk training; the body learns where the salt does and does not bite.",
    abilityType: "inherited",
    cost: "—",
    cooldown: "None",
    limit: "Only on Reach causeways",
    chapterRange: "Ch. 1, 2",
    mentionsByChapter: [1,2,0,0,0,0,0,0,0,0,0,0],
    requirements: ["Race: Reach-folk OR Class: Salt-bearer"],
    effects: [{ trigger: "On entering causeway", effect: "Ignore terrain penalty" }],
    upgradePath: [],
    linkedStats:    [],
    linkedRaces:    [{ id: "r1", type: "races", label: "Reach-folk" }],
    linkedClasses:  [{ id: "cl1", type: "classes", label: "Salt-bearer" }],
    characters:     [{ id: "c1", type: "cast", label: "Aelinor Vey" }, { id: "c3", type: "cast", label: "Captain Brec" }],
    usageHistory: [],
  },
];

// Merge into global samples (keep existing entries that aren't overridden).
(function _mergeRpgSamples() {
  const samples = window.ENTITY_SAMPLES || {};
  const merge = (key, replacement) => {
    const existing = samples[key] || [];
    const ids = new Set(replacement.map((r) => r.id));
    const keep = existing.filter((e) => !ids.has(e.id));
    samples[key] = [...replacement, ...keep];
  };
  merge("items",     RPG_ITEM_DATA);
  merge("classes",   RPG_CLASS_DATA);
  merge("races",     RPG_RACE_DATA);
  merge("stats",     RPG_STAT_DATA);
  merge("abilities", RPG_ABILITY_DATA);
  window.ENTITY_SAMPLES = samples;
})();

// =====================================================================
// PER-TYPE FILTER CHIP DEFINITIONS (passed through to EntityRoster)
// =====================================================================

const RPG_FILTERS = {
  items: [
    { key: "type:weapon",   label: "Type: Weapon" },
    { key: "type:apparel",  label: "Type: Apparel" },
    { key: "type:tool",     label: "Type: Tool" },
    { key: "type:trinket",  label: "Type: Trinket" },
    { key: "rarity:common", label: "Rarity: Common" },
    { key: "rarity:uncommon", label: "Rarity: Uncommon" },
    { key: "rarity:rare",   label: "Rarity: Rare" },
    { key: "rarity:heirloom", label: "Rarity: Heirloom" },
    { key: "rarity:legendary",label: "Rarity: Legendary" },
    { key: "status:equipped",label: "Status: Equipped" },
    { key: "status:lost",   label: "Status: Lost" },
    { key: "status:traded", label: "Status: Traded" },
    { key: "link:quest",    label: "Quest-linked" },
    { key: "chapter:current", label: "Current chapter" },
    { key: "certainty:high",  label: "High certainty" },
    { key: "certainty:weak",  label: "Weak / uncertain" },
  ],
  classes: [
    { key: "category:functionary",label: "Category: Functionary" },
    { key: "category:hereditary", label: "Category: Hereditary" },
    { key: "category:itinerant",  label: "Category: Itinerant" },
    { key: "role:support",        label: "Role: Support" },
    { key: "role:skirmisher",     label: "Role: Skirmisher" },
    { key: "status:active",       label: "Status: Active" },
    { key: "members:any",         label: "Has members" },
    { key: "members:none",        label: "No members yet" },
  ],
  races: [
    { key: "category:folk",     label: "Category: Folk" },
    { key: "category:other",    label: "Category: Other" },
    { key: "linked:faction",    label: "Linked to faction" },
    { key: "linked:atlas",      label: "Has origin location" },
    { key: "status:active",     label: "Status: Active" },
  ],
  stats: [
    { key: "valueType:number",  label: "Value: Number" },
    { key: "valueType:scale",   label: "Value: Scale / label" },
    { key: "valueType:bool",    label: "Value: Boolean" },
    { key: "usage:character",   label: "Used by character" },
    { key: "usage:item",        label: "Used by item" },
    { key: "rules:any",         label: "Has extraction rules" },
    { key: "rules:none",        label: "No rules yet" },
  ],
  abilities: [
    { key: "type:active",       label: "Type: Active" },
    { key: "type:passive",      label: "Type: Passive" },
    { key: "type:triggered",    label: "Type: Triggered" },
    { key: "type:one-time",     label: "Type: One-time" },
    { key: "type:inherited",    label: "Type: Inherited" },
    { key: "linked:class",      label: "Linked to class" },
    { key: "linked:race",       label: "Linked to race" },
    { key: "linked:skill",      label: "Linked to skill tree" },
    { key: "upgrade:any",       label: "Has upgrade path" },
  ],
};

// =====================================================================
// REGISTRY — host code looks up the renderer by entityType
// =====================================================================

const RPG_DETAIL_RENDERERS = {
  items:     (entity, ctx) => <ItemDetail    entity={entity} {...ctx}/>,
  classes:   (entity, ctx) => <ClassDetail   entity={entity} {...ctx}/>,
  races:     (entity, ctx) => <RaceDetail    entity={entity} {...ctx}/>,
  stats:     (entity, ctx) => <StatDetail    entity={entity} {...ctx}/>,
  abilities: (entity, ctx) => <AbilityDetail entity={entity} {...ctx}/>,
};

Object.assign(window, {
  ItemDetail, ClassDetail, RaceDetail, StatDetail, AbilityDetail,
  RpgSection, RpgFacets, RpgStatChip, RpgChipRow, RpgChapterSpark, RpgKV,
  RPG_DETAIL_RENDERERS, RPG_FILTERS,
  RPG_ITEM_DATA, RPG_CLASS_DATA, RPG_RACE_DATA, RPG_STAT_DATA, RPG_ABILITY_DATA,
});
