import { useEffect } from 'react';
import { Station, STATIONS, useSettingsStore } from '../../state/settingsStore';
import { useTutorialStore } from '../../state/tutorialStore';
import { useUIStore } from '../../state/uiStore';

interface SliderProps {
  label: string;
  value: number; // 0..1
  onChange: (v: number) => void;
}

function Slider({ label, value, onChange }: SliderProps) {
  const pct = Math.round(value * 100);
  return (
    <label className="settings-slider">
      <div className="settings-slider-label">
        <span>{label}</span>
        <span className="settings-slider-value">{pct}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </label>
  );
}

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen);
  const close = useUIStore((s) => s.closeSettings);

  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const station = useSettingsStore((s) => s.station);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const setStation = useSettingsStore((s) => s.setStation);
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);

  const resetTutorial = useTutorialStore((s) => s.resetAll);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div
      className="modal-root"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-card settings-modal">
        <div className="modal-header">
          <h2>SETTINGS</h2>
          <button
            type="button"
            className="modal-close"
            onClick={close}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="settings-section">
          <h3>Audio</h3>
          <Slider label="Music volume" value={musicVolume} onChange={setMusicVolume} />
          <Slider label="SFX volume" value={sfxVolume} onChange={setSfxVolume} />
        </div>

        <div className="settings-section">
          <h3>Radio</h3>
          <p className="hint">Pick a soundtrack mood. Each station has tracks for different parts of the run.</p>
          <div className="settings-stations">
            {STATIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`settings-station ${station === s.id ? 'is-active' : ''}`}
                onClick={() => setStation(s.id as Station)}
              >
                <div className="settings-station-name">{s.name}</div>
                <div className="settings-station-desc">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>Accessibility</h3>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
            />
            <span>Reduce motion</span>
          </label>
          <p className="hint">Disables shake, zoom, and pulse animations.</p>
        </div>

        <div className="settings-section">
          <h3>Tutorial</h3>
          <button
            type="button"
            onClick={() => {
              resetTutorial();
              close();
            }}
          >
            RESTART TUTORIAL
          </button>
          <p className="hint">Replays each tutorial step the next time it would have appeared.</p>
        </div>

        <div className="modal-footer">
          <button type="button" className="primary" onClick={close}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
