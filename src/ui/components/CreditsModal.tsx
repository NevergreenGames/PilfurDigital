import { useEffect } from 'react';
import { useUIStore } from '../../state/uiStore';

export function CreditsModal() {
  const open = useUIStore((s) => s.creditsOpen);
  const close = useUIStore((s) => s.closeCredits);

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
      aria-label="Credits"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-card credits-modal">
        <div className="modal-header">
          <h2>CREDITS</h2>
          <button
            type="button"
            className="modal-close"
            onClick={close}
            aria-label="Close credits"
          >
            ✕
          </button>
        </div>

        <div className="credits-body">
          <p>
            <strong>Pilfur</strong> — a small heist-themed dice roguelike.
          </p>
          <p className="muted">Design, code, and visual direction by the Pilfur team.</p>
          <p className="muted">
            Music tracks (when present) are sourced from public-domain and
            CC-licensed libraries. See <code>audio/RECOMMENDED.md</code> in
            the project for attribution details.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="primary" onClick={close}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
