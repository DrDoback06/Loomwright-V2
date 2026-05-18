# RPG Entities — Hook-up notes (Loomwright v2)

These five panels (Items, Classes, Races, Stats, Abilities) plug into the
existing panel stack and the shared `EntityFrameworkPanelBody`. Each panel
gets a bespoke detail renderer (defined in `rpg-entities.jsx` →
`RPG_DETAIL_RENDERERS`) and a curated filter chip set
(`RPG_FILTERS[entityType]`). No backend logic — everything is sample data
and callback wiring.

The vocabulary is genre-neutral: *modifier*, *affix*, *trigger*, *tier*,
*ability* — usable by any author building any RPG-flavoured system.

---

## Item

```ts
type Item = {
  id: string;
  type: "items";
  name: string;
  glyphChar?: string;        // 2-letter monogram for the roster
  status: "active" | "lost" | "destroyed" | "traded";

  // Faceted metadata (top chip strip)
  itemType: string;          // "Weapon · Tool", "Apparel · Cloak", …
  rarity: "Common" | "Uncommon" | "Rare" | "Heirloom" | "Legendary" | "Cursed";
  slot?: string;             // "Two-handed", "Finger", "Outerwear", …
  weight?: string;
  first?: string;            // "Ch. 1, p. 12"

  summary?: string;
  subtitle?: string;

  // Modifiers + affixes
  modifiers: ItemModifier[];
  affixes:   { name: string; note: string }[];
  effects:   ItemEffect[];

  // Ownership
  currentOwner?: { id: string; type: "cast"; name: string } | null;
  ownership:   ItemOwnershipEvent[];   // chronological
  equipped:    ItemOwnershipEvent[];   // equipped/unequipped log
  trades:      ItemOwnershipEvent[];   // trades + drops
  upgrades:    ItemOwnershipEvent[];   // upgrades + degradation

  // Links
  quests:  EntityRef[];
  events:  EntityRef[];

  // Spatial
  sites: {
    found?: { id?: string; name: string; cite?: string };
    used?:  { id?: string; name: string }[];
    lost?:  { id?: string; name: string; cite?: string } | null;
  };

  mentionsByChapter?: number[];
  chapterRange?: string;
  queue?: number; queueLevel?: ConfidenceLevel;
};

type ItemModifier = {
  target: string;    // a stat name
  delta: number;     // signed integer
  note?: string;
};

type ItemEffect = {
  trigger: string;
  effect: string;
  cost?: string;
};

type ItemOwnershipEvent = {
  chapter: number;
  what: string;
  cite?: string;     // "Ch. 1, p. 12"
  kind?: "ownership" | "equipped" | "trade" | "upgrade";  // assigned by the UI
};
```

### Callbacks

```
onCreateItem()
onEditItem(item)
onAssignItemOwner(item, ownerId)
onEquipItem(item, characterId)
onUnequipItem(item, characterId)
onTradeItem(item, fromId, toId)
onDropItem(item)
onDestroyItem(item)
onUpgradeItem(item, upgradeId)
onAddItemModifier(item, modifier)
onAddItemEffect(item, effect)
onShowItemOnAtlas(item)
onOpenSourceMention(ev)
```

---

## Class

```ts
type ClassEntity = {
  id: string;
  type: "classes";
  name: string;
  glyphChar?: string;
  status: "active" | "archived";

  category: string;             // "Functionary" | "Hereditary" | "Itinerant" | …
  role?: string;                // "Support / civic", "Symbolic / lead", …
  subtitle?: string;
  summary?: string;
  first?: string;

  defaultStats: StatBlock[];
  allowedAbilities: EntityRef[];
  skillTrees: EntityRef[];
  restrictions: string[];
  typicalRoles: string[];
  examples: EntityRef[];        // example characters

  mentionsByChapter?: number[];
};

type StatBlock = {
  name: string;
  value: number | string;
  min?: number;
  max?: number;
  kind?: "number" | "scale" | "boolean" | "custom";
};
```

### Callbacks

```
onCreateClass()
onEditClass(cls)
onAssignClass(cls, characterId)
onDuplicateClass(cls)
onDeleteClass(cls)
onLinkClassAbility(cls, abilityId)
onLinkClassSkillTree(cls, skillTreeId)
onShowClassCharacters(cls)
```

---

## Race / Species

```ts
type RaceEntity = {
  id: string;
  type: "races";
  name: string;
  glyphChar?: string;
  status: "active" | "archived";

  category: "Folk" | "Other";
  subtitle?: string;
  summary?: string;
  first?: string;

  traits: string[];
  defaultStats: StatBlock[];
  abilities: EntityRef[];      // innate
  cultureNotes?: string;
  originLocations: EntityRef[];
  factions: EntityRef[];
  bestiaryLinks?: EntityRef[];
  examples: EntityRef[];

  mentionsByChapter?: number[];
};
```

### Callbacks

```
onCreateRace()
onEditRace(race)
onAssignRace(race, characterId)
onDuplicateRace(race)
onShowRaceOnAtlas(race)
onLinkRaceFaction(race, factionId)
onLinkRaceBestiary(race, bestiaryId)
onLinkRaceAbility(race, abilityId)
```

---

## Stat

```ts
type StatEntity = {
  id: string;
  type: "stats";
  name: string;
  glyphChar?: string;
  status: "active" | "archived";

  valueType: "number" | "scale" | "boolean" | "text" | "custom";
  defaultValue?: number | string | boolean;
  min?: number; max?: number;

  subtitle?: string;
  summary?: string;

  extractionRules: StatExtractionRule[];
  history: StatChangeEvent[];

  linkedAbilities: EntityRef[];
  usedByCharacters: EntityRef[];
  itemsAffecting: EntityRef[];

  chapterRange?: string;
  mentionsByChapter?: number[];
};

type StatExtractionRule = {
  phrase: string;        // "resolve increased by +N"
  treatedAs: string;     // "Exact +N"
  kind: "exact" | "decrease" | "qual";
  review: boolean;       // does the rule require human review?
};

type StatChangeEvent = {
  chapter: number;
  subject: string;       // character / faction / item that changed
  delta?: number;        // signed; absent when qualitative
  qualitative?: string;  // human-readable label when no number
  cite?: string;
};
```

### Callbacks

```
onCreateStat()
onAssignStat(stat, holderId)
onUpdateStatValue(stat, holderId, value)
onAddStatChangeRule(stat, rule)
onOpenStatHistory(stat, holderId?)
```

---

## Ability

```ts
type AbilityEntity = {
  id: string;
  type: "abilities";
  name: string;
  glyphChar?: string;
  status: "active" | "archived";

  abilityType: "active" | "passive" | "one-time" | "triggered"
             | "inherited" | "temporary" | "custom";

  cost?: string;
  cooldown?: string;
  limit?: string;
  subtitle?: string;
  summary?: string;
  first?: string;
  chapterRange?: string;
  mentionsByChapter?: number[];

  requirements: string[];
  effects: AbilityEffect[];
  upgradePath: AbilityTier[];

  linkedStats:    EntityRef[];
  linkedClasses:  EntityRef[];
  linkedRaces:    EntityRef[];
  skillTreeNodes: EntityRef[];
  characters:     EntityRef[];

  usageHistory: AbilityUsageEvent[];
};

type AbilityEffect = {
  trigger: string;
  effect: string;
  cost?: string;
};

type AbilityTier = {
  tier: string;
  name: string;
  effect: string;
  unlocked: boolean;
};

type AbilityUsageEvent = {
  chapter: number;
  who: string;
  what: string;
  cite?: string;
};
```

### Callbacks

```
onCreateAbility()
onAssignAbility(ability, characterId)
onUpgradeAbility(ability, tier)
onLinkAbilityToSkillTree(ability, skillTreeId)
onOpenAbilityUsageHistory(ability, characterId?)
```

---

## Shared

```ts
type EntityRef = {
  id: string;
  type: EntityType;
  label: string;
  count?: number;
  tone?: "good" | "warn" | "danger" | "route" | "neutral";
};

type ConfidenceLevel = "high" | "strong" | "uncertain" | "weak";
```

### Universal callbacks (review queue + source mentions)

```
onOpenReviewQueue(entityType)
onAcceptQueueItem(item)
onEditQueueItem(item)
onMergeQueueItem(item)
onDenyQueueItem(item)
onOpenSourceMention(ref)
onOpenRelatedTab(ref)
```

---

## Cross-panel relationships (rendered as `RpgChipRow`s)

| From      | To           | Where it surfaces |
|-----------|--------------|-------------------|
| Item      | Cast         | "Owner" facet + history rows |
| Item      | Atlas        | "Locations" section (Found / Used / Lost) |
| Item      | Quests/Events| "Quest & event links" section |
| Class     | Cast         | "Example characters" |
| Class     | Abilities    | "Allowed abilities" |
| Class     | Skill Trees  | "Skill trees" |
| Race      | Cast         | "Example characters" |
| Race      | Atlas        | "Origin locations" |
| Race      | Factions     | "Faction links" |
| Race      | Bestiary     | "Related bestiary entries" |
| Stat      | Cast/Factions| "Characters using stat" |
| Stat      | Items        | "Items affecting stat" |
| Stat      | Abilities    | "Related abilities" |
| Ability   | Stats        | "Linked stats" |
| Ability   | Classes/Races| "Linked class & race" |
| Ability   | Skill Trees  | "Skill tree nodes" |
| Ability   | Cast         | "Characters with this ability" |

Each chip is rendered through `<RpgChipRow>` and clicks bubble through
`onSelectEntity` → `onOpenRelatedTab` so consumers can decide whether
to open the target's panel, focus it inline, or both.
