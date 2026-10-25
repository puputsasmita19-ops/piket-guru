import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { Check, ChevronDown } from '../icons';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Human-friendly heading for mobile choices. */
  mobileTitle: string;
};
interface OptionRow { value: string; label: string; disabled: boolean; }
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
    const label = typeof props.children === 'string' || typeof props.children === 'number'
      ? String(props.children) : String(props.value ?? '');
    options.push({ value: String(props.value ?? label), label, disabled: groupDisabled || Boolean(props.disabled) });
  });
  return options;
}
/** Keep native select on desktop; replace Android's oversized OS picker with compact, accessible choices on mobile. */
export function MobileChoiceSelect({ mobileTitle, children, value, onChange, onInvalid, className = '', disabled, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => flattenOptions(children), [children]);
  const current = options.find(option => option.value === String(value ?? ''));
  // A permission change or a disabled form must dismiss an existing chooser.
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const choose = (selectedValue: string) => {
    // Reject stale choices if the options/permissions changed while the dialog was open.
    const selected = options.find(option => option.value === selectedValue);
    if (disabled || !selected || selected.disabled) return;
    // All migrated forms use e.target.value; keep the same stored enum values.
    onChange?.({ target: { value: selectedValue } } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };
  const handleInvalid = (event: React.FormEvent<HTMLSelectElement>) => {
    onInvalid?.(event);
    // Keep native required validation on desktop. On mobile show the same
    // chooser users can interact with, instead of focusing a hidden select.
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches) {
      event.preventDefault();
      setOpen(true);
    }
  };
  return <>
    <select {...rest} value={value} onChange={onChange} onInvalid={handleInvalid} disabled={disabled} className={`${className} hidden sm:block`}>{children}</select>
    <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={`${mobileTitle}: ${current?.label || 'Pilih'}`}
      onClick={() => setOpen(true)} className={`${className} sm:!hidden !flex items-center justify-between gap-3 min-w-0 text-left min-h-11`}>
      <span className="min-w-0 whitespace-normal break-words leading-snug">{current?.label || 'Pilih salah satu'}</span>
      <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
    </button>
    <Modal isOpen={open && !disabled} onClose={() => setOpen(false)} title={mobileTitle} maxWidth="md">
      <div role="group" aria-label={mobileTitle} className="max-h-[55dvh] overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-700">
        {options.map(option => <button key={option.value} type="button" disabled={option.disabled} aria-pressed={current?.value === option.value}
          onClick={() => choose(option.value)} className="flex w-full min-h-12 items-center justify-between gap-4 px-3 py-3 text-left text-sm text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-600">
          <span className="min-w-0 break-words leading-relaxed">{option.label}</span>
          {current?.value === option.value && <Check className="h-5 w-5 shrink-0 text-sky-600" />}
        </button>)}
      </div>
    </Modal>
  </>;
}
