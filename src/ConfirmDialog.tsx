import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Ask = (message: string) => Promise<boolean>;
const Context = createContext<Ask | null>(null);

// Chromium's synchronous window.confirm can leave Electron's Windows window
// without keyboard focus. Keep confirmations inside the document instead.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<{
    resolve: (value: boolean) => void;
    focus: HTMLElement | null;
  } | null>(null);
  const ask = useCallback<Ask>((text) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = {
        resolve,
        focus:
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
      };
      setMessage(text);
    });
  }, []);
  const finish = useCallback((accepted: boolean) => {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    dialog.current?.close();
    setMessage(null);
    request.resolve(accepted);
    requestAnimationFrame(() => {
      const target = request.focus?.isConnected
        ? request.focus
        : (document.querySelector<HTMLElement>(
            'input[aria-label="Yeni personel adı"]',
          ) ??
          document.querySelector<HTMLElement>(
            "input:not([disabled]), button:not([disabled])",
          ));
      target?.focus();
    });
  }, []);
  useEffect(() => {
    if (message !== null && !dialog.current?.open) dialog.current?.showModal();
  }, [message]);
  useEffect(
    () => () => {
      pending.current?.resolve(false);
      pending.current = null;
    },
    [],
  );
  return (
    <Context.Provider value={ask}>
      {children}
      {message !== null && (
        <dialog
          ref={dialog}
          className="modal confirmation-dialog"
          aria-labelledby="confirmation-title"
          aria-describedby="confirmation-message"
          onCancel={(event) => {
            event.preventDefault();
            finish(false);
          }}
          onClose={() => finish(false)}
        >
          <h2 id="confirmation-title">İşlemi onaylayın</h2>
          <p id="confirmation-message">{message}</p>
          <div className="button-row">
            <button
              autoFocus
              className="button secondary"
              onClick={() => finish(false)}
            >
              Vazgeç
            </button>
            <button className="button primary" onClick={() => finish(true)}>
              Onayla
            </button>
          </div>
        </dialog>
      )}
    </Context.Provider>
  );
}
export function useConfirm() {
  const ask = useContext(Context);
  if (!ask) throw Error("ConfirmProvider gerekli");
  return ask;
}
