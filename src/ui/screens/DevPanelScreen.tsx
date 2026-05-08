import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import {
  ContentKind,
  clearAllOverrides,
  clearOverride,
  getAllPatches,
  getBase,
  getMerged,
  getOverride,
  patchCount,
  setAllPatches,
  setOverride,
  subscribe,
} from '../../state/contentRegistry';
import {
  AbilityEditor,
  CharacterEditor,
  EventEditor,
  PhaseCardEditor,
  RigEditor,
  TargetEditor,
  TutorialStepEditor,
} from '../components/DevPanelEditors';
import {
  getUnlockedCharacterIds,
  resetProgress,
  subscribe as subscribeProgress,
  unlockAllCharacters,
} from '../../state/progress';
import {
  getUnlockedAchievementIds,
  resetAchievements,
  subscribe as subscribeAchievements,
  unlockAllAchievements,
} from '../../state/achievements';
import { CHARACTERS } from '../../content/characters';
import { ACHIEVEMENTS } from '../../content/achievements';
import {
  Character,
  CharacterAbility,
  EventDef,
  HeistTarget,
  PhaseCard,
  Rig,
} from '../../engine/types';
import { TutorialStep } from '../../tutorial/steps';
import { useTutorialStore } from '../../state/tutorialStore';

const TABS: { kind: ContentKind; label: string }[] = [
  { kind: 'phase', label: 'PHASE CARDS' },
  { kind: 'ability', label: 'ABILITIES' },
  { kind: 'target', label: 'TARGETS' },
  { kind: 'event', label: 'EVENTS' },
  { kind: 'tutorial', label: 'TUTORIAL' },
  { kind: 'character', label: 'CHARACTERS' },
  { kind: 'rig', label: 'RIGS' },
];

// Display label for each item in the left list — falls back to id when
// the record has neither name nor title (shouldn't happen, but safe).
function labelFor(item: Record<string, unknown>): string {
  if (typeof item.name === 'string') return item.name;
  if (typeof item.title === 'string') return item.title;
  return String(item.id);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
      return false;
  }
  return true;
}

// Build the smallest patch (top-level field diff) needed to express
// `desired` on top of `base`. Drops fields that match base so the saved
// override stays minimal and reverts naturally when a tweak is undone.
function diffPatch(
  base: Record<string, unknown>,
  desired: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(desired)]);
  for (const k of keys) {
    if (k === 'id') continue;
    if (!(k in desired)) continue;
    if (!deepEqual(base[k], desired[k])) {
      out[k] = desired[k];
    }
  }
  return out;
}

function FORMATTED_BASE_JSON(item: Record<string, unknown>): string {
  const { id: _id, ...rest } = item;
  void _id;
  return JSON.stringify(rest, null, 2);
}

export function DevPanelScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const resetTutorialSeen = useTutorialStore((s) => s.resetAll);

  const [tab, setTab] = useState<ContentKind>('phase');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The form-editor's working draft. Holds the full merged item; SAVE
  // converts it to a per-id patch via diffPatch.
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Click-to-rename: when true, the detail header swaps the <h2> for an
  // <input> bound to the same draft name/title field. Commits to the
  // draft on every keystroke (so Save / Revert work as usual); Enter
  // and blur leave rename mode, Escape leaves AND restores the prior
  // value.
  const [renaming, setRenaming] = useState(false);
  const [renameRevertTo, setRenameRevertTo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Re-render when the registry changes (Save / Revert / Import / Reset).
  const [, forceTick] = useState(0);
  useEffect(() => subscribe(() => forceTick((n) => n + 1)), []);
  // Re-render when the progress store changes (unlock-all / reset-progress
  // debug buttons) so the unlocked-character chips below stay in sync.
  useEffect(() => subscribeProgress(() => forceTick((n) => n + 1)), []);
  // Same for the achievements store.
  useEffect(() => subscribeAchievements(() => forceTick((n) => n + 1)), []);

  const baseList = getBase(tab);
  const mergedList = getMerged(tab);
  const baseById = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const it of baseList) m.set(it.id, it);
    return m;
    // baseList identity is stable per tab; depend on tab so we recompute
    // when the user switches collections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const mergedById = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const it of mergedList) m.set(it.id, it);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mergedList.length]);

  const baseSelected = selectedId ? baseById.get(selectedId) : null;
  const mergedSelected = selectedId ? mergedById.get(selectedId) : null;
  const overridden = !!(selectedId && getOverride(tab, selectedId));
  const isDirty =
    !!draft && !!baseSelected && !deepEqual(diffPatch(baseSelected, draft), getOverride(tab, selectedId!) ?? {});

  // Hydrate the draft when the selection (or tab) changes.
  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const merged = mergedById.get(selectedId);
    if (!merged) {
      setDraft(null);
      return;
    }
    setDraft(JSON.parse(JSON.stringify(merged)));
    // Switching items always cancels rename mode — otherwise the input
    // could carry over to a different item's name field.
    setRenaming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tab]);

  // Status banner auto-clears after a few seconds.
  useEffect(() => {
    if (!statusMessage) return;
    const t = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [statusMessage]);

  const handleSave = () => {
    if (!selectedId || !baseSelected || !draft) return;
    const patch = diffPatch(baseSelected, draft);
    if (Object.keys(patch).length === 0) {
      clearOverride(tab, selectedId);
      setStatusMessage(`No diff vs base — override cleared for ${selectedId}.`);
      return;
    }
    setOverride(tab, selectedId, patch);
    setStatusMessage(`Saved override for ${selectedId}.`);
  };

  const handleRevert = () => {
    if (!selectedId) return;
    clearOverride(tab, selectedId);
    const base = baseById.get(selectedId);
    if (base) setDraft(JSON.parse(JSON.stringify(base)));
    setStatusMessage(`Reverted ${selectedId}.`);
  };

  const handleResetAll = () => {
    const total = TABS.reduce((acc, t) => acc + patchCount(t.kind), 0);
    if (total === 0) {
      setStatusMessage('No overrides to clear.');
      return;
    }
    const ok = window.confirm(
      `Discard all ${total} override(s) across every tab? This can't be undone.`,
    );
    if (!ok) return;
    clearAllOverrides();
    if (selectedId) {
      const base = baseById.get(selectedId);
      if (base) setDraft(JSON.parse(JSON.stringify(base)));
    }
    setStatusMessage('All overrides cleared.');
  };

  const handleExport = () => {
    const data = JSON.stringify(getAllPatches(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `pilfur-patches-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage('Exported patches JSON.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setAllPatches(parsed);
        if (selectedId) {
          const merged = getMerged(tab).find((it) => it.id === selectedId);
          if (merged) setDraft(JSON.parse(JSON.stringify(merged)));
        }
        setStatusMessage(`Imported ${f.name}.`);
      } catch (err) {
        setStatusMessage(
          'Import failed: ' + (err instanceof Error ? err.message : String(err)),
        );
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const tabPatchCounts: Record<ContentKind, number> = {
    phase: patchCount('phase'),
    ability: patchCount('ability'),
    target: patchCount('target'),
    event: patchCount('event'),
    tutorial: patchCount('tutorial'),
    character: patchCount('character'),
    rig: patchCount('rig'),
  };

  // Pick the right form editor for the active tab. Each editor receives
  // the working draft (typed cast — we know the kind from the tab).
  const renderEditor = () => {
    if (!draft || !mergedSelected) return null;
    const onChange = (next: Record<string, unknown>) =>
      setDraft({ ...next, id: String(mergedSelected.id) });
    switch (tab) {
      case 'phase':
        return (
          <PhaseCardEditor
            value={draft as unknown as PhaseCard}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
      case 'ability':
        return (
          <AbilityEditor
            value={draft as unknown as CharacterAbility}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
      case 'target':
        return (
          <TargetEditor
            value={draft as unknown as HeistTarget}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
      case 'event':
        return (
          <EventEditor
            value={draft as unknown as EventDef}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
      case 'tutorial':
        return (
          <TutorialStepEditor
            value={draft as unknown as TutorialStep}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
      case 'character':
        return (
          <CharacterEditor
            value={draft as unknown as Character}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
      case 'rig':
        return (
          <RigEditor
            value={draft as unknown as Rig}
            onChange={(v) => onChange(v as unknown as Record<string, unknown>)}
          />
        );
    }
  };

  return (
    <div className="dev-panel">
      <header className="dev-panel-head">
        <div className="dev-panel-title">
          <span className="dev-panel-tag">// DESIGN //</span>
          <h1>DEV PANEL</h1>
        </div>
        <div className="dev-panel-toolbar">
          <button type="button" onClick={handleExport}>
            EXPORT
          </button>
          <button type="button" onClick={handleImportClick}>
            IMPORT
          </button>
          <button type="button" onClick={handleResetAll} className="danger-ish">
            RESET ALL
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => setScreen('title')}
          >
            CLOSE
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </header>

      <div className="dev-panel-tabs">
        {TABS.map((t) => {
          const n = tabPatchCounts[t.kind];
          return (
            <button
              key={t.kind}
              type="button"
              onClick={() => setTab(t.kind)}
              className={`dev-tab${tab === t.kind ? ' dev-tab--active' : ''}`}
            >
              {t.label}
              {n > 0 && <span className="dev-tab-badge">{n}</span>}
            </button>
          );
        })}
      </div>

      {statusMessage && <div className="dev-panel-status">{statusMessage}</div>}

      <div className="dev-panel-help">
        Edits apply to <strong>new content</strong> generated after the save —
        the next heist's grid, the next draft, the next event you open.
        In-flight tiles aren't rewritten. Patches persist in localStorage; use
        EXPORT for cross-machine backups.
      </div>

      <div className="dev-panel-debug">
        <div className="dev-panel-debug-title">DEBUG</div>
        <div className="dev-panel-debug-row">
          <span className="dev-panel-debug-label">
            Unlocked: {getUnlockedCharacterIds().length}/{CHARACTERS.length}
            {' '}
            <span className="muted">
              ({getUnlockedCharacterIds().join(', ') || 'none'})
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              unlockAllCharacters();
              setStatusMessage('All characters unlocked.');
            }}
          >
            UNLOCK ALL CHARACTERS
          </button>
          <button
            type="button"
            className="danger-ish"
            onClick={() => {
              const ok = window.confirm(
                'Wipe character-unlock progress? Only the first character will remain unlocked.',
              );
              if (!ok) return;
              resetProgress();
              setStatusMessage('Progress reset.');
            }}
          >
            RESET PROGRESS
          </button>
        </div>

        <div className="dev-panel-debug-row">
          <span className="dev-panel-debug-label">
            Achievements: {getUnlockedAchievementIds().length}/{ACHIEVEMENTS.length}
            {' '}
            <span className="muted">
              ({getUnlockedAchievementIds().join(', ') || 'none'})
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              unlockAllAchievements();
              setStatusMessage('All achievements unlocked.');
            }}
          >
            UNLOCK ALL ACHIEVEMENTS
          </button>
          <button
            type="button"
            className="danger-ish"
            onClick={() => {
              const ok = window.confirm(
                'Wipe achievement progress? Locked rigs will become inaccessible again.',
              );
              if (!ok) return;
              resetAchievements();
              setStatusMessage('Achievements reset.');
            }}
          >
            RESET ACHIEVEMENTS
          </button>
        </div>

        <div className="dev-panel-debug-row">
          <span className="dev-panel-debug-label">
            Tutorial-seen state controls whether each step ever fires again.
          </span>
          <button
            type="button"
            className="danger-ish"
            onClick={() => {
              resetTutorialSeen();
              setStatusMessage('Tutorial seen state cleared.');
            }}
          >
            RESET TUTORIAL SEEN
          </button>
        </div>
      </div>

      <div className="dev-panel-body">
        <aside className="dev-list">
          <div className="dev-list-header">
            <span>{mergedList.length} items</span>
          </div>
          <ul>
            {mergedList.map((it) => {
              const isOverridden = !!getOverride(tab, it.id);
              const active = it.id === selectedId;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    className={`dev-list-item${active ? ' dev-list-item--active' : ''}${
                      isOverridden ? ' dev-list-item--overridden' : ''
                    }`}
                    onClick={() => setSelectedId(it.id)}
                  >
                    <span className="dev-list-name">{labelFor(it)}</span>
                    <span className="dev-list-id">{it.id}</span>
                    {isOverridden && (
                      <span className="dev-list-flag" title="overridden">
                        •
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="dev-detail">
          {!mergedSelected && (
            <div className="dev-detail-empty">
              Pick an item on the left to edit it.
            </div>
          )}
          {mergedSelected && baseSelected && draft && (
            <>
              <div className="dev-detail-head">
                <div>
                  {(() => {
                    // Tutorial steps have no name/title and their id is the
                    // stable lookup key — skip the rename treatment entirely.
                    if (tab === 'tutorial') {
                      return (
                        <h2 className="dev-detail-name">
                          {String(mergedSelected.id)}
                        </h2>
                      );
                    }
                    // Field that drives the displayed name — events use
                    // `title`, everything else uses `name`. Same key is
                    // what the rename input writes back to the draft.
                    const renameField = tab === 'event' ? 'title' : 'name';
                    const currentName = String(draft[renameField] ?? '');
                    if (renaming) {
                      return (
                        <input
                          autoFocus
                          className="dev-detail-rename"
                          value={currentName}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [renameField]: e.target.value,
                            })
                          }
                          onBlur={() => setRenaming(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setRenaming(false);
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              setDraft({
                                ...draft,
                                [renameField]: renameRevertTo,
                              });
                              setRenaming(false);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onFocus={(e) =>
                            (e.target as HTMLInputElement).select()
                          }
                        />
                      );
                    }
                    return (
                      <h2
                        className="dev-detail-name"
                        onClick={() => {
                          setRenameRevertTo(currentName);
                          setRenaming(true);
                        }}
                        title="Click to rename"
                      >
                        {currentName || labelFor(mergedSelected)}
                      </h2>
                    );
                  })()}
                  <span className="dev-detail-id">
                    {String(mergedSelected.id)}
                  </span>
                  {overridden && (
                    <span className="dev-detail-pill">OVERRIDDEN</span>
                  )}
                  {isDirty && (
                    <span
                      className="dev-detail-pill dev-detail-pill--dirty"
                      title="Unsaved changes"
                    >
                      UNSAVED
                    </span>
                  )}
                </div>
                <div className="dev-detail-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSave}
                    disabled={!isDirty}
                  >
                    SAVE
                  </button>
                  <button
                    type="button"
                    onClick={handleRevert}
                    disabled={!overridden}
                  >
                    REVERT
                  </button>
                </div>
              </div>

              <div className="dev-detail-form">{renderEditor()}</div>

              <details className="dev-base-snapshot">
                <summary>BASE (default JSON)</summary>
                <pre>{FORMATTED_BASE_JSON(baseSelected)}</pre>
              </details>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
