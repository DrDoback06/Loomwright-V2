import type { EntityConfig } from './types';

const ITEM_TYPES = [
  'Weapon', 'Armour', 'Clothing', 'Tool', 'Key', 'Relic', 'Artefact', 'Document', 'Map', 'Book', 'Evidence', 'Resource', 'Consumable', 'Vehicle', 'Symbol', 'Magical', 'Technological', 'Mundane', 'Other',
] as const;
const EQUIPMENT_SLOTS = [
  'Head', 'Body', 'Hands', 'Main Hand', 'Off Hand', 'Accessory', 'Tool', 'Relic', 'Pack', 'Quest', 'Custom',
] as const;
const RARITY = ['Common', 'Uncommon', 'Rare', 'Heirloom', 'Legendary', 'Cursed', 'Unique'] as const;
const ITEM_CONDITIONS = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken', 'Destroyed'] as const;
const ITEM_STATUSES = ['active', 'carried', 'equipped', 'stored', 'lost', 'destroyed', 'retired', 'dormant'] as const;

/** Ported from the legacy EE_ITEM config (entity-editor-configs.jsx)
 * — same sections and field ids so extraction field-mapping and future
 * imports stay compatible. */
export const itemsConfig: EntityConfig = {
  type: 'items',
  displayName: 'Item',
  defaultSummary:
    'An object the story can pick up, lose, equip, or hand to another. Anchor it with one strong physical detail.',
  sections: [
    {
      id: 'basics',
      title: 'Basics',
      fields: [
        { id: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Bone Auger', span: 2 },
        { id: 'aliases', label: 'Aliases', kind: 'chips', span: 2 },
        { id: 'itemType', label: 'Type', kind: 'pills', options: ITEM_TYPES, required: true },
        { id: 'customType', label: 'Custom type', kind: 'text' },
        { id: 'rarity', label: 'Rarity / Tier', kind: 'pills', options: RARITY },
        { id: 'summary', label: 'One-line summary', kind: 'text', span: 2 },
        { id: 'description', label: 'Physical description', kind: 'textarea', span: 2 },
      ],
    },
    {
      id: 'physical',
      title: 'Physical + value',
      fields: [
        { id: 'icon', label: 'Icon glyph', kind: 'text', hint: 'Two letters used as a placeholder icon' },
        { id: 'weight', label: 'Weight', kind: 'text', placeholder: 'e.g. 3.4 lb' },
        { id: 'value', label: 'Value', kind: 'text', placeholder: 'Currency / barter / priceless' },
        { id: 'condition', label: 'Condition', kind: 'pills', options: ITEM_CONDITIONS },
        { id: 'durability', label: 'Durability / Charges', kind: 'text', placeholder: 'e.g. 3 / 3' },
      ],
    },
    {
      id: 'ownership',
      title: 'Ownership & location',
      fields: [
        { id: 'currentOwner', label: 'Current owner', kind: 'related', related: 'cast' },
        { id: 'currentLocation', label: 'Current location', kind: 'related', related: 'locations' },
        { id: 'status', label: 'Status', kind: 'pills', options: ITEM_STATUSES },
        // TODO(M5): legacy kind 'slot-picker' — restore equipment-slot picker widget.
        { id: 'slot', label: 'Equipment slot', kind: 'pills', options: EQUIPMENT_SLOTS },
        { id: 'carried', label: 'Carried', kind: 'toggle' },
        { id: 'equipped', label: 'Equipped', kind: 'toggle' },
      ],
    },
    {
      id: 'effects',
      title: 'Properties, modifiers, effects',
      fields: [
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'modifiers', label: 'Stat modifiers', kind: 'chips', hint: 'Each row: target stat, +N/-N, note. e.g. Resolve +2' },
        // TODO(M5): legacy kind 'rule-list' — restore structured rule rows.
        { id: 'affixes', label: 'Affixes / Tags', kind: 'chips', hint: 'Affix name + note. e.g. Salt-bitten' },
        // TODO(M5): legacy kind 'effects-list' — restore structured effect rows.
        { id: 'passive', label: 'Passive effects', kind: 'chips', hint: 'Always-on effects when carried' },
        // TODO(M5): legacy kind 'effects-list' — restore structured effect rows.
        { id: 'active', label: 'Active effects', kind: 'chips', hint: 'Triggered manually by user' },
        // TODO(M5): legacy kind 'effects-list' — restore structured effect rows.
        { id: 'triggered', label: 'Triggered effects', kind: 'chips', hint: 'Triggered by a specific event' },
        { id: 'restrictions', label: 'Use restrictions', kind: 'textarea', hint: 'Who can use it, when, where, why not.' },
      ],
    },
    {
      id: 'compatibility',
      title: 'Compatibility',
      fields: [
        { id: 'compatibleClasses', label: 'Compatible classes', kind: 'related-multi', related: 'classes' },
        { id: 'compatibleRaces', label: 'Compatible races', kind: 'related-multi', related: 'races' },
        { id: 'linkedStats', label: 'Linked stats', kind: 'related-multi', related: 'stats' },
        { id: 'linkedSkills', label: 'Linked skills', kind: 'related-multi', related: 'skills' },
      ],
    },
    {
      id: 'story',
      title: 'Story links',
      fields: [
        { id: 'quests', label: 'Linked quests', kind: 'related-multi', related: 'quests' },
        { id: 'events', label: 'Linked events', kind: 'related-multi', related: 'events' },
        { id: 'factions', label: 'Linked factions', kind: 'related-multi', related: 'factions' },
        { id: 'foundLocation', label: 'Found at', kind: 'related', related: 'locations' },
        { id: 'lostLocation', label: 'Lost at', kind: 'related', related: 'locations' },
        { id: 'destroyedLocation', label: 'Destroyed at', kind: 'related', related: 'locations' },
        { id: 'usedLocations', label: 'Used at', kind: 'related-multi', related: 'locations' },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      fields: [
        { id: 'firstChapter', label: 'First seen chapter', kind: 'text' },
        { id: 'lastChapter', label: 'Last seen chapter', kind: 'text' },
        { id: 'ownershipHistory', label: 'Ownership history', kind: 'textarea', hint: "Chronological — who's held it." },
        { id: 'tradeTransferHistory', label: 'Trade / transfer log', kind: 'textarea', hint: 'Structured transfers — JSON array preferred.' },
        { id: 'sourceMentions', label: 'Source mentions', kind: 'textarea', hint: 'Quotes / passages where this item appears.', span: 2 },
        { id: 'notes', label: 'Notes (private)', kind: 'textarea', span: 2 },
        { id: 'references', label: 'References', kind: 'related-multi', related: 'references', span: 2 },
      ],
    },
    {
      id: 'review-save',
      title: 'Tags',
      fields: [
        { id: 'tags', label: 'Tags', kind: 'chips', span: 2 },
      ],
    },
  ],
};
