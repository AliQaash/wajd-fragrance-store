import { createContext, useCallback, useContext, useState } from "react";
import { Link } from "react-router-dom";

const ToastContext = createContext(null);

/** Short success messages, bottom of the screen, with an optional link. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, link) => {
    const id = Date.now();
    setToast({ id, message, link });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.message}</span>
            {toast.link && (
              <Link to={toast.link.to} onClick={() => setToast(null)}>
                {toast.link.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
