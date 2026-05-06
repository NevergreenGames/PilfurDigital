import { useGameStore } from '../../state/gameStore';

/**
 * Floating "DEV" badge — opens the design tuning panel from any screen.
 * Pinned to the bottom-right so it doesn't fight the gear icon (top-right)
 * or the heist sidebar (right column).
 *
 * Hidden once the dev panel is the active screen — the panel has its own
 * close button and keeping the badge would just stack two exits.
 */
export function DevPanelButton() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  if (screen === 'dev') return null;
  return (
    <button
      type="button"
      className="dev-panel-fab"
      onClick={() => setScreen('dev')}
      title="Open the design / balance dev panel"
      aria-label="Open dev panel"
    >
      DEV
    </button>
  );
}
