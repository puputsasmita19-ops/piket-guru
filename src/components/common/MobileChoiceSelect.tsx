import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Check, ChevronDown } from '../icons';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Concise heading for the compact mobile choice sheet. */
  mobileTitle: string;
};
type OptionRow = { value: string; label: string; disabled: boolean };

/** Extract human-readable option captions, including JSX child arrays like
 * <option value={t.code}>{t.icon} {t.label}</option>. In R76, these arrays
 * accidentally fell back to the raw enum codes (e.g. SAKIT_PULANG).
 */
function optionCaption(children: React.ReactNode): string {
  const parts: string[] = [];
  React.Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
    } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      // Most captions are plain text; nested inline labels are supported too.
      // Avoid rendering SVG icon geometry as accidental text.
      if (typeof child.type === 'string' && (child.type === 'svg' || child.type === 'img')) return;
      parts.push(optionCaption(child.props.children));
    }
  });
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function friendlyFallback(value: string): string {
  // Only a display fallback; never modifies option.value, Firestore or API.
  const label = value.replace(/_/g, ' ').trim();
  if (!label) return 'Pilih salah satu';
  return label.replace(/\b\S/g, char => char.toLocaleUpperCase('id-ID'))
    .replace(/([A-Z])([A-Z]+)/g, (word) => word.slice(0, 1) + word.slice(1).toLocaleLowerCase('id-ID'));
}

function flattenOptions(children: React.ReactNode, groupDisabled = false): OptionRow[] {
  const options: OptionRow[] = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment || child.type === 'optgroup') {
      const group = child.props as { children?: React.ReactNode; disabled?: boolean };
      options.push(...flattenOptions(group.children, groupDisabled || (child.type === 'optgroup' && Boolean(group.disabled))));
      return;
    }
    if (child.type !== 'option') return;
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    const rawValue = String(props.value ?? optionCaption(props.children));
    options.push({
      value: rawValue,
      label: optionCaption(props.children) || friendlyFallback(rawValue),
      disabled: groupDisabled || Boolean(props.disabled),
    });
  });
  return options;
}

/** Native select on desktop; compact touch targets and friendly labels in mobile.
 * The stored option values and existing form handlers remain unchanged. */
export function MobileChoiceSelect({ mobileTitle, children, value, onChange, onInvalid,
  className = '', disabled, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => flattenOptions(children), [children]);
  const current = options.find(option => option.value === String(value ?? ''));

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const choose = (selectedValue: string) => {
    const selected = options.find(option => option.value === selectedValue);
    if (disabled || !selected || selected.disabled) return;
    // The existing forms read e.target.value only. Keep the *original* code.
    onChange?.({ target: { value: selectedValue } } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  const handleInvalid = (event: React.FormEvent<HTMLSelectElement>) => {
    onInvalid?.(event);
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches) {
      event.preventDefault();
      setOpen(true);
    }
  };

  return <>
    <select {...rest} value={value} onChange={onChange} onInvalid={handleInvalid}
      disabled={disabled} className={`${className} hidden sm:block`}>{children}</select>
    <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
      aria-label={`${mobileTitle}: ${current?.label || 'Pilih'}`} onClick={() => setOpen(true)}
      className={`${className} sm:!hidden !flex items-center justify-between gap-3 min-w-0 text-left min-h-11`}>
      <span className="min-w-0 whitespace-normal break-words leading-snug">{current?.label || 'Pilih salah satu'}</span>
      <ChevronDown className="w-4 h-4 shrink-0 opacity-60" aria-hidden="true" />
    </button>
    <Modal isOpen={open && !disabled} onClose={() => setOpen(false)} title={mobileTitle} maxWidth="md">
      <div role="group" aria-label={mobileTitle}
        className="max-h-[55dvh] overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-700">
        {options.map(option => (
          <button key={option.value} type="button" disabled={option.disabled}
            aria-pressed={current?.value === option.value} onClick={() => choose(option.value)}
            className="flex w-full min-h-12 items-center justify-between gap-4 px-3 py-3 text-left text-sm text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-600">
            <span className="min-w-0 break-words leading-relaxed">{option.label}</span>
            {current?.value === option.value && <Check className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </Modal>
  </>;
}
