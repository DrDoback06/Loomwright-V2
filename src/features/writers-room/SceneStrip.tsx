import { createScene, deleteSceneToTrash, renameScene } from '@/db/repos/scenes';
import type { Scene, SceneStatus } from '@/db/types';
import { toast } from '@/stores/toasts';

/** Status is the Board's default column and the Matrix's default tint, so
 * it earns a place on the strip rather than hiding in the metadata panel. */
export const STATUS_META: Record<SceneStatus, { label: string; glyph: string }> = {
  outline: { label: 'Outline', glyph: '○' },
  draft: { label: 'Draft', glyph: '◐' },
  revised: { label: 'Revised', glyph: '◑' },
  final: { label: 'Final', glyph: '●' },
};

interface SceneStripProps {
  projectId: string;
  chapterId: string;
  scenes: Scene[];
  activeSceneId: string | null;
  onSelect: (sceneId: string) => void;
}

/** The scenes of the current chapter, as a strip under the chapter tabs.
 * A chapter is a container; this is where the prose actually lives. */
export function SceneStrip({
  projectId,
  chapterId,
  scenes,
  activeSceneId,
  onSelect,
}: SceneStripProps) {
  const addScene = async (afterSceneId?: string) => {
    const scene = await createScene(projectId, chapterId, undefined, afterSceneId ?? null);
    onSelect(scene.id);
  };

  return (
    <div className="lw-scenestrip" role="tablist" aria-label="Scenes">
      {scenes.map((scene, index) => (
        <button
          key={scene.id}
          type="button"
          role="tab"
          aria-selected={scene.id === activeSceneId}
          className={
            scene.id === activeSceneId ? 'lw-scenetab lw-scenetab--active' : 'lw-scenetab'
          }
          onClick={() => onSelect(scene.id)}
        >
          <span className="lw-scenetab__num" aria-hidden>
            {index + 1}
          </span>
          <span className="lw-scenetab__title">{scene.title}</span>
          <span
            className="lw-scenetab__status"
            aria-label={STATUS_META[scene.status].label}
            title={STATUS_META[scene.status].label}
          >
            {STATUS_META[scene.status].glyph}
          </span>
          <span className="lw-scenetab__words" aria-hidden>
            {scene.wordCount > 0 ? `${scene.wordCount.toLocaleString()}w` : '—'}
          </span>
        </button>
      ))}
      <button
        type="button"
        className="lw-scenetab lw-scenetab--new"
        onClick={() => void addScene()}
      >
        + Scene
      </button>
    </div>
  );
}

interface SceneHeadProps {
  scene: Scene;
  sceneCount: number;
  index: number;
  onAddAfter: () => void;
  onDeleted: () => void;
}

/** Scene title, position and delete. Deleting the last scene of a chapter
 * is refused rather than silently leaving the chapter with nowhere to
 * type — delete the chapter if that is what was meant. */
export function SceneHead({ scene, sceneCount, index, onAddAfter, onDeleted }: SceneHeadProps) {
  return (
    <div className="lw-scenehead">
      <span className="lw-scenehead__pos" aria-hidden>
        Scene {index + 1} of {sceneCount}
      </span>
      <input
        className="lw-scenehead__title"
        aria-label="Scene title"
        value={scene.title}
        onChange={(e) => void renameScene(scene.id, e.target.value)}
      />
      <button type="button" className="lw-btn" onClick={onAddAfter}>
        + Insert scene
      </button>
      <button
        type="button"
        className="lw-btn"
        disabled={sceneCount <= 1}
        title={
          sceneCount <= 1
            ? 'A chapter keeps at least one scene — delete the chapter instead'
            : 'Move this scene to the trash'
        }
        onClick={() => {
          void deleteSceneToTrash(scene.id).then(() => {
            toast(`“${scene.title}” moved to trash.`);
            onDeleted();
          });
        }}
      >
        Delete scene
      </button>
    </div>
  );
}
