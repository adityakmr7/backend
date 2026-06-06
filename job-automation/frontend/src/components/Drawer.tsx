'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface DrawerHandle<T> {
  /** Currently selected payload; null when closed. */
  payload: T | null;
  open: (payload: T) => void;
  close: () => void;
  /**
   * Renderer. Pass a function that gets the payload and returns the drawer
   * body — keeps the drawer dumb about what's inside it.
   */
  drawer: (render: (payload: T) => ReactNode) => ReactNode;
}

/**
 * Right-side slide-in drawer. One-liner API:
 *
 *   const d = useDrawer<Application>();
 *   <Card onClick={() => d.open(app)} />
 *   {d.drawer((app) => <ApplicationDrawerBody app={app} ... />)}
 */
export function useDrawer<T>(): DrawerHandle<T> {
  const [payload, setPayload] = useState<T | null>(null);

  const open = useCallback((p: T) => setPayload(p), []);
  const close = useCallback(() => setPayload(null), []);

  // Body scroll lock + escape close
  useEffect(() => {
    if (payload === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [payload, close]);

  const drawer = useCallback(
    (render: (p: T) => ReactNode) => (
      <DrawerShell open={payload !== null} onClose={close}>
        {payload !== null ? render(payload) : null}
      </DrawerShell>
    ),
    [payload, close]
  );

  return { payload, open, close, drawer };
}

function DrawerShell({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: ReactNode }) {
  // Keep the panel in the tree even when closed for the exit animation.
  // We only render the backdrop while open to avoid intercepting clicks.
  return (
    <>
      {open && (
        <div
          className="modal-backdrop"
          style={{ background: 'rgba(15,26,20,0.30)' }}
          onClick={onClose}
        />
      )}
      <aside
        className={`drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  );
}
