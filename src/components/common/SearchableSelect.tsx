import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Check, ChevronDown, Search } from '../icons';

export interface SearchableOption { value: string; label: string; description?: string; keywords?: string; disabled?: boolean }
interface Props {
  label: string; value: string; options: SearchableOption[]; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean; required?: boolean; name?: string;
}
const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').trim();

/** A bounded searchable dialog avoids Android's full-screen native select list. */
export function SearchableSelect({ label, value, options, onChange, placeholder = 'Pilih dari daftar', disabled, required, name }: Props) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const id = useId(), search = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find(option => option.value === value), [options, value]);
  // Shared picker: precompute searchable text only when the data set changes.
  // Render a bounded first page of results so opening a picker with hundreds of
  // teachers does not block the first paint on a low-end phone.
  const indexedOptions = useMemo(() => options.map(option => ({
    option, normalizedText: normalize(`${option.label} ${option.description || ''} ${option.keywords || ''}`),
  })), [options]);
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return indexedOptions.filter(item => words.every(word => item.normalizedText.includes(word))).map(item => item.option);
  }, [indexedOptions, options, query]);
  const visibleOptions = useMemo(() => filtered.slice(0, query.trim() ? 80 : 40), [filtered, query]);
  const close = () => { setOpen(false); setQuery(''); setActive(0); };
  useEffect(() => { if (disabled) close(); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => search.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    const item = list.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`);
    if (item && list.current) {
      if (item.offsetTop < list.current.scrollTop) list.current.scrollTop = item.offsetTop;
      else if (item.offsetTop + item.offsetHeight > list.current.scrollTop + list.current.clientHeight) list.current.scrollTop = item.offsetTop + item.offsetHeight - list.current.clientHeight;
    }
  }, [active, open]);
  const choose = (option?: SearchableOption) => { if (option && !option.disabled && !disabled) { onChange(option.value); close(); } };
  return <div className="searchable-select min-w-0">
    <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled}
      onClick={() => { setQuery(''); setActive(0); setOpen(true); }}
      className="searchable-select-trigger w-full min-h-11 flex items-center justify-between gap-2 text-left rounded-xl border border-[var(--theme-card-border,#cbd5e1)] bg-[var(--theme-card-bg,#fff)] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50">
      <span className="min-w-0 line-clamp-2 break-words">{selected?.label || (value ? 'Pilihan tersimpan (tidak ada di daftar aktif)' : placeholder)}</span><ChevronDown className="w-4 h-4 shrink-0" />
    </button>
    {(required || name) && <input aria-hidden="true" tabIndex={-1} className="sr-only" name={name} value={value} required={required} disabled={disabled} onChange={() => {}} onInvalid={event => { event.preventDefault(); setOpen(true); }} />}
    <Modal isOpen={open} onClose={close} title={label} maxWidth="md">
      <div className="space-y-3 min-w-0">
        <div className="relative"><Search className="absolute w-4 h-4 left-3 top-3.5 text-slate-500" /><input ref={search} type="search" autoComplete="off" role="combobox" aria-label={`Cari ${label.toLocaleLowerCase('id-ID')}`} aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={visibleOptions[active] ? `${id}-${active}` : undefined}
          value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder="Cari nama, ID, atau kata kunci…"
          className="w-full min-h-11 rounded-xl border border-[var(--theme-card-border,#cbd5e1)] bg-[var(--theme-card-bg,#fff)] text-slate-900 dark:text-slate-100 pl-10 pr-3 text-base"
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, Math.min(visibleOptions.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
            if (event.key === 'Enter') { event.preventDefault(); choose(visibleOptions[active]); }
          }} /></div>
        <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{filtered.length} pilihan{filtered.length > visibleOptions.length ? ` · ${visibleOptions.length} ditampilkan, ketik untuk mencari lainnya` : query ? ' sesuai pencarian' : ' · ketik untuk mempersempit daftar'}</p>
        <div ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="searchable-select-list relative overflow-y-auto overscroll-contain rounded-xl border border-[var(--theme-card-border,#cbd5e1)]" style={{ maxHeight: 'min(32dvh, 280px)' }}>
          {visibleOptions.map((option, index) => <button key={option.value} id={`${id}-${index}`} data-option-index={index} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled}
            onPointerMove={event => { if (event.pointerType === 'mouse' && active !== index) setActive(index); }} onClick={() => choose(option)}
            className={`searchable-select-option flex items-center justify-between gap-3 text-left w-full min-h-11 px-3 py-2 border-b last:border-b-0 border-[var(--theme-card-border,#cbd5e1)] text-sm disabled:opacity-40 ${active === index ? 'bg-[var(--theme-surface-subtle,#f1f5f9)]' : 'bg-[var(--theme-card-bg,#fff)]'}`}>
            <span className="min-w-0 break-words"><span className="block font-medium">{option.label}</span>{option.description && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</span>}</span>{option.value === value && <Check className="w-4 h-4 shrink-0" />}
          </button>)}
          {!filtered.length && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Tidak ditemukan. Coba kata kunci lain.</p>}
        </div>
      </div>
    </Modal>
  </div>;
}
