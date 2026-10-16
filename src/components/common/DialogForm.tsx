import React, { useEffect, useRef } from 'react';

interface DialogFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  actions: React.ReactNode;
}

/** Fields scroll independently; actions remain inside their form for native submit. */
export const DialogForm: React.FC<DialogFormProps> = ({ children, actions, className = '', ...props }) => {
  const fieldsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let lastAlert: Element | null = null;
    const observer = new MutationObserver(() => {
      const alert = fieldsRef.current?.querySelector<HTMLElement>('[role="alert"]');
      if (alert && alert !== lastAlert) {
        lastAlert = alert;
        alert.scrollIntoView?.({ block: 'nearest' });
        alert.focus({ preventScroll: true });
      } else if (!alert) lastAlert = null;
    });
    if (fieldsRef.current) observer.observe(fieldsRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
  <form {...props} className="app-dialog-form">
    <div ref={fieldsRef} className={`app-form-fields ${className}`}>{children}</div>
    <div className="app-form-footer">{actions}</div>
  </form>
  );
};
