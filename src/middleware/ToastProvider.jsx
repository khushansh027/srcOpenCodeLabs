import { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const ToastContext = createContext(null);

let idCounter = 0;
const nextId = () => ++idCounter;

function ensureToastRoot() {
    let el = document.getElementById("toast-root");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast-root";
        // keep it visually above everything
        el.style.position = "fixed";
        el.style.top = "0";
        el.style.right = "0";
        el.style.zIndex = "9999";
        document.body.appendChild(el);
        // debug
        console.debug("[ToastProvider] created #toast-root portal node");
    }
    return el;
}

function ToastPortal({ children }) {
    const el = ensureToastRoot();
    return createPortal(children, el);
}

export function ToastProvider({ children, position = "top-right" }) {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        console.debug("[ToastProvider] mounted, toasts ready");
        return () => {
            console.debug("[ToastProvider] unmounted");
        };
    }, []);

    const push = useCallback((toast) => {
        const tid = nextId();
        const created = { id: tid, duration: 4000, ...toast };
        setToasts((t) => [...t, created]);
        console.debug("[ToastProvider] push", created);
        if (created.duration > 0) {
            setTimeout(() => {
                setToasts((t) => t.filter((x) => x.id !== tid));
                console.debug("[ToastProvider] auto-removed toast", tid);
            }, created.duration);
        }
        return tid;
    }, []);

    const remove = useCallback((tid) => {
        setToasts((t) => t.filter((x) => x.id !== tid));
        console.debug("[ToastProvider] removed toast", tid);
    }, []);

    const toast = useMemo(
        () => ({
            push,
            remove,
            success: (message, opts = {}) => push({ type: "success", message, ...opts }),
            error: (message, opts = {}) => push({ type: "error", message, ...opts }),
            info: (message, opts = {}) => push({ type: "info", message, ...opts }),
        }),
        [push, remove]
    );

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastPortal>
                <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 12, pointerEvents: "none", padding: 12 }}>
                    {toasts.map((t) => (
                        <Toast key={t.id} toast={t} onClose={() => remove(t.id)} />
                    ))}
                </div>
            </ToastPortal>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // helpful error to detect wrong usage (hook used outside provider)
        throw new Error("useToast must be used within a ToastProvider");
    }
    return ctx;
}

function Toast({ toast, onClose }) {
    const { id, type = "info", message = "" } = toast;

    const base = {
        pointerEvents: "auto",
        width: 320,
        maxWidth: "calc(100vw - 40px)",
        borderRadius: 10,
        padding: "12px 14px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
    };

    const typeStyles = {
        success: { background: "linear-gradient(90deg,#16a34a,#10b981)", color: "white" },
        error: { background: "linear-gradient(90deg,#ef4444,#f97316)", color: "white" },
        info: { background: "linear-gradient(90deg,#6366f1,#7c3aed)", color: "white" },
    };

    const style = { ...base, ...(typeStyles[type] || typeStyles.info) };

    return (
        <div role="status" style={style}>
            <div style={{ fontSize: 18, marginTop: 2 }}>
                {type === "success" ? "✓" : type === "error" ? "!" : "i"}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, textTransform: "capitalize" }}>{type}</div>
                <div style={{ fontSize: 14 }}>{message}</div>
            </div>
            <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 16 }}
            >
                ✕
            </button>
        </div>
    );
}
