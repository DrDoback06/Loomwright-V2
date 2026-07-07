import { useUiStore, type RouteId } from '@/stores/ui';

interface HelpEntry {
  title: string;
  points: string[];
}

const HELP: Record<RouteId, HelpEntry> = {
  home: {
    title: 'Home',
    points: [
      'Live project stats — every tile is a door to the surface it counts.',
      'Recent activity lists everything that changed, with one-click Undo.',
      'Ctrl/Cmd+K opens the command palette from anywhere.',
    ],
  },
  today: {
    title: 'Today',
    points: [
      '"Words today" counts against a baseline armed the first time Loomwright sees your project each day.',
      'Cards suggest the next thing to do: continue the latest chapter, clear Review, advance a quest step, dust off a neglected entry.',
    ],
  },
  'writers-room': {
    title: "Writer's Room",
    points: [
      'Autosave runs ~600ms after you stop typing; the status strip says Saved when it lands. Switching chapters or closing the tab flushes first — nothing is lost.',
      'Save & Extract scans the chapter offline and sends candidates to Review — nothing enters the codex silently.',
      'Highlighted names are known entities — click one to open its dossier. Notes pins a comment to a paragraph.',
      'Compose builds a brief from your codex; with a provider key it can draft prose you can insert.',
    ],
  },
  codex: {
    title: 'Codex',
    points: [
      'Rosters hold every entry of a type. The dossier shows everything known; Edit opens the full editor.',
      'Lock an entity to make other panels follow it; Merge into… rewrites every mention, link, and pending candidate in one transaction.',
      'Save as template snapshots the shape (not the identity) for reuse from Tools ▸ Templates.',
    ],
  },
  atlas: {
    title: 'Atlas',
    points: [
      'Place pins for locations, drag to move them; layers toggle labels, travel routes, and the grid.',
      'Travel routes derive from cast travelHistory — they update as your story moves people.',
    ],
  },
  tangle: {
    title: 'Tangle',
    points: [
      'A corkboard for threads the codex can’t hold yet: free note cards, entity cards, labelled directed threads.',
      'Save a board as a template and stamp it anywhere — fresh cards, rewired threads.',
    ],
  },
  'skill-trees': {
    title: 'Skill Trees',
    points: [
      'Constellation canvases: place skills, link prerequisites, mark unlocks.',
      'Nodes can bind to skill entities so trees and codex stay one world.',
    ],
  },
  review: {
    title: 'Review',
    points: [
      'Everything extraction finds queues here — nothing changes the codex until you accept it.',
      'Bands: blue = known mention, green = confident, orange = probable, red = weak. Bulk-accept the obvious, deny the noise.',
      'Accept as alias merges a nickname into an existing entry and backfills its mentions.',
    ],
  },
  handoff: {
    title: 'Import & Extract',
    points: [
      'Paste a whole chapter or book and Extract offline — it chunks the text, scans every chunk, and drops findings into Review. No AI, no keys.',
      'Or copy the mega-prompt (your world digest + a facts-and-suggestions schema) into ANY external AI, paste the reply back, and it lands in Review + the dossier inboxes.',
    ],
  },
  settings: {
    title: 'Settings',
    points: [
      'BYOK: keys are AES-GCM encrypted on this device and never exported, logged, or searched.',
      'Local-only mode blocks every external AI call app-wide.',
      'Data & interchange: full project export/import (keys never included) and world-bible export.',
      'Extraction tuning: per-detector confidence sliders.',
    ],
  },
  trash: {
    title: 'Trash',
    points: [
      'Deleted things wait here — Restore returns them intact (chapters keep their text).',
      'Delete forever double-confirms. Project deletion is separate, in the project switcher.',
    ],
  },
  'random-tables': {
    title: 'Random Tables',
    points: [
      'Weighted idea generators. Starters are built in; editing one copies it to your tables first.',
      'Every result can append to your latest chapter or prefill a new codex entry.',
    ],
  },
  'speed-reader': {
    title: 'Speed Reader',
    points: [
      'RSVP reading with punctuation-aware pacing — read your chapters back at speed to hear the rhythm.',
      'The red pivot letter marks the optimal recognition point.',
    ],
  },
  templates: {
    title: 'Templates',
    points: [
      'Entity templates prefill the create drawer; nine genre starters are built in.',
      'Save your own from any dossier; board templates come from the Tangle.',
    ],
  },
};

/** Per-surface help: one dialog, content keyed to the current route. */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const route = useUiStore((s) => s.route);
  const entry = HELP[route];

  return (
    <div className="lw-drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="lw-dialog"
        role="dialog"
        aria-label={`Help: ${entry.title}`}
        data-testid="help-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="lw-card__title">{entry.title} — how it works</h2>
        <ul className="lw-help__points">
          {entry.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="lw-fieldnote">
          Loomwright is local-first: everything lives in this browser. Export regularly from
          Settings ▸ Data &amp; interchange.
        </p>
        <div className="lw-chips__add">
          <button type="button" className="lw-btn lw-btn--primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
