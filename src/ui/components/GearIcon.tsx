import { useUIStore } from '../../state/uiStore';

export function GearIcon() {
  const open = useUIStore((s) => s.openSettings);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  return (
    <button
      type="button"
      className={`gear-icon ${settingsOpen ? 'gear-icon--active' : ''}`}
      aria-label="Open settings"
      onClick={open}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm7.43 3.5c0 .34-.03.67-.07.99l2.11 1.65a.5.5 0 0 1 .12.64l-2 3.46a.5.5 0 0 1-.6.22l-2.49-1a7.4 7.4 0 0 1-1.71.99l-.38 2.65a.5.5 0 0 1-.5.4h-4a.5.5 0 0 1-.5-.4l-.38-2.65a7.4 7.4 0 0 1-1.71-.99l-2.49 1a.5.5 0 0 1-.6-.22l-2-3.46a.5.5 0 0 1 .12-.64l2.11-1.65A7.5 7.5 0 0 1 4.57 13c0-.34.03-.67.07-.99L2.53 10.36a.5.5 0 0 1-.12-.64l2-3.46a.5.5 0 0 1 .6-.22l2.49 1c.52-.4 1.1-.74 1.71-.99l.38-2.65a.5.5 0 0 1 .5-.4h4a.5.5 0 0 1 .5.4l.38 2.65c.61.25 1.19.59 1.71.99l2.49-1a.5.5 0 0 1 .6.22l2 3.46a.5.5 0 0 1-.12.64l-2.11 1.65c.04.32.07.65.07.99z"
        />
      </svg>
    </button>
  );
}
