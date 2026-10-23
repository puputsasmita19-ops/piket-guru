import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Save, ShieldAlert, Volume2, Plus, Trash2, MapPin, Bell, CalendarDays, Megaphone, Phone, ArrowLeft, CheckCircle2 } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolSettings } from '../../types';
import type { EmergencyType } from '../../types/security.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { SchoolBellService } from '../../services/audio/bellService';
import {
  normalizeCommandCenterConfig, validateCommandCenterConfig, SCHOOL_BELL_KINDS,
  EMERGENCY_TYPES, EMERGENCY_CONTACT_IDS, BELL_TONE_TYPES, BELL_WEEKDAYS, BELL_DAY_LABELS, type CommandCenterConfig, type SchoolBellKind,
} from '../../types/commandCenterConfig.types';

const BELLS: Record<SchoolBellKind, () => void> = {
  MASUK: () => SchoolBellService.playSchoolBell(),
  GANTI_JAM: () => SchoolBellService.playPeriodChangeBell(),
  ISTIRAHAT: () => SchoolBellService.playBreakBell(),
  PULANG: () => SchoolBellService.playDismissalBell(),
};
const TYPE_LABELS: Record<string, string> = { EARTHQUAKE: 'Gempa Bumi', FIRE: 'Kebakaran', SECURITY: 'Keamanan', EVACUATION: 'Evakuasi', GENERAL: 'Siaran Khusus' };
const inputStyle = 'w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[var(--theme-ring)]';
const labelStyle = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5';

type Tab = 'command' | 'bell' | 'schedule' | 'emergency' | 'additional' | 'contacts';

const sections: { key: Tab; title: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key:'command', title:'Lokasi Pusat Komando', description:'Judul layar, ruang posko, titik kumpul dan arahan menuju posko.', icon:MapPin },
  { key:'bell', title:'Bel Manual', description:'Nama tombol bel dan uji suara hanya di perangkat ini.', icon:Bell },
  { key:'schedule', title:'Jadwal Bel', description:'Jam WIB, hari, nama sesi, pilihan nada dan status jadwal.', icon:CalendarDays },
  { key:'emergency', title:'Pesan Siaga Bawaan', description:'Instruksi, checklist dan kontak untuk jenis siaga utama.', icon:ShieldAlert },
  { key:'additional', title:'Jenis Bencana Tambahan', description:'Tambah atau nonaktifkan jenis kejadian sesuai kondisi sekolah.', icon:Megaphone },
  { key:'contacts', title:'Kontak & SOP', description:'Nomor rujukan darurat dan langkah prosedur siaga.', icon:Phone },
];

export type EmergencyEditorRequest = { tab: 'emergency' | 'additional' | 'schedule' | 'bell' | 'command'; type?: EmergencyType; sequence: number };
export function CommandCenterSettingsCard({ settings, onUpdated, focusRequest }: { settings: SchoolSettings; onUpdated: (value: SchoolSettings) => void; focusRequest?: EmergencyEditorRequest | null }) {
  const { currentUser, hasRole } = useAuth();
  const admin = hasRole('ADMIN');
  const [tab, setTab] = useState<Tab>('command');
  const [editing, setEditing] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyType>('EARTHQUAKE');
  const editorRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CommandCenterConfig>(() => normalizeCommandCenterConfig(settings.commandCenterConfig));
  const [original, setOriginal] = useState<CommandCenterConfig>(() => normalizeCommandCenterConfig(settings.commandCenterConfig));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const dirty = useMemo(() => editing && JSON.stringify(draft) !== JSON.stringify(original), [editing, draft, original]);
  const selectedSection = sections.find(item => item.key === tab)!;

  useEffect(() => {
    if (editing) return;
    const next = normalizeCommandCenterConfig(settings.commandCenterConfig);
    setDraft(next); setOriginal(next);
  }, [settings.commandCenterConfig, editing]);

  useEffect(() => {
    if (!focusRequest || !admin) return;
    setTab(focusRequest.tab);
    if (focusRequest.type) setSelectedEmergency(focusRequest.type);
    if (!editing) {
      const next = normalizeCommandCenterConfig(settings.commandCenterConfig);
      setOriginal(next); setDraft(next); setMessage(null); setEditing(true);
    }
    const frame = requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }));
    return () => cancelAnimationFrame(frame);
    // Sequence is a user click signal; unchanged settings must not reset an active editor.
  }, [focusRequest?.sequence]);

  const change = (part: Partial<CommandCenterConfig>) => setDraft(prev => ({ ...prev, ...part }));
  const editBell = (id: string, patch: Partial<CommandCenterConfig['scheduledBells'][number]>) =>
    setDraft(prev => ({...prev, scheduledBells: prev.scheduledBells.map(bell => bell.id === id ? {...bell, ...patch} : bell)}));
  const addBell = () => {
    setDraft(prev => {
      if (prev.scheduledBells.length >= 20) return prev;
      // Opaque edit-only ID; not based on person or school identity.
      const id = `bell_custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {...prev, scheduledBells: [...prev.scheduledBells, {
        id, time:'08:00', label:'Sesi Bel Baru', description:'', toneType:'PERIOD_CHANGE', isActive:false, days:[1,2,3,4,5],
      }]};
    });
  };
  const addScenario = () => setDraft(prev => {
    if (prev.customEmergencies.length >= 12) return prev;
    const id = `scenario_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { ...prev, customEmergencies: [...prev.customEmergencies, {
      id, label: '', description: '', title: '', message: '', operatorChecklist: '',
      contactId: 'BPBD', isActive: false,
    }] };
  });
  const updateScenario = (id: string, patch: Partial<CommandCenterConfig['customEmergencies'][number]>) =>
    setDraft(prev => ({ ...prev, customEmergencies: prev.customEmergencies.map(item => item.id === id ? { ...item, ...patch } : item) }));
  const changePost = (patch: Partial<CommandCenterConfig['commandPost']>) =>
    setDraft(prev => ({ ...prev, commandPost: { ...prev.commandPost, ...patch } }));
  const beginEdit = (nextTab: Tab = tab) => {
    setTab(nextTab);
    const next = normalizeCommandCenterConfig(settings.commandCenterConfig);
    setOriginal(next); setDraft(next); setMessage(null); setEditing(true);
  };
  const cancel = () => {
    if (saving || (dirty && !window.confirm('Perubahan yang belum disimpan akan dibuang. Kembali ke daftar pengaturan?'))) return;
    setDraft(original); setEditing(false); setMessage(null);
  };

  useEffect(() => {
    if (!dirty) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventAccidentalExit);
    return () => window.removeEventListener('beforeunload', preventAccidentalExit);
  }, [dirty]);
  const save = async () => {
    if (!admin || !currentUser || saving) return;
    const errors = validateCommandCenterConfig(draft);
    if (errors.length) { setMessage({ error: true, text: errors.join(' ') }); return; }
    setSaving(true); setMessage(null);
    try {
      const result = await SchoolSettingsService.saveCommandCenterConfig(draft, currentUser.id, original);
      onUpdated(result.settings); setEditing(false);
      setMessage({ error: false, text: 'Pengaturan Pusat Komando berhasil disimpan di Firebase.' });
    } catch (e: any) {
      setMessage({ error: true, text: e?.message || 'Gagal menyimpan konfigurasi.' });
    } finally { setSaving(false); }
  };

  return <Card>
    <div ref={editorRef} data-command-settings-editor className="scroll-mt-24" />
    <CardHeader title="Pengaturan Bel & Darurat" subtitle="Pilih bagian yang ingin diatur. Semua perubahan baru berlaku setelah disimpan oleh Admin." />
    <CardContent className="p-4 sm:p-6 space-y-5">
      {!editing ? <>
        {message && <div role={message.error ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-xl p-3 text-sm ${message.error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{!message.error && <CheckCircle2 className="w-4 h-4 shrink-0"/>}{message.text}</div>}
        <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <strong className="text-slate-800 dark:text-slate-100">Cara mengatur:</strong> pilih satu kategori → ubah isinya → simpan. Pengaturan akan muncul di Pusat Komando setelah tersinkron. <strong>Menyimpan tidak membunyikan sirene.</strong>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-label="Daftar kategori pengaturan Bel dan Darurat" data-emergency-setting-overview>
          {sections.map(({key,title,description,icon:Icon},index) => <button key={key} type="button" onClick={() => beginEdit(key)} disabled={!admin} className="group text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 min-h-[128px] flex flex-col gap-3 hover:border-cyan-400 hover:bg-cyan-50/40 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 transition-colors" aria-label={`Atur ${title}`}>
            <div className="flex items-center gap-3"><span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-sky-50 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300"><Icon className="w-5 h-5"/></span><span className="min-w-0 text-sm font-bold text-slate-900 dark:text-white">{index+1}. {title}</span></div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 flex-1">{description}</p>
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">Lihat & atur →</span>
          </button>)}
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <p className="font-bold text-sm text-slate-800 dark:text-white">Ringkasan konfigurasi saat ini</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <p><strong>Posko:</strong> {draft.commandPost.primary || 'Belum diisi'}</p>
            <p><strong>Jadwal aktif:</strong> {draft.scheduledBells.filter(item => item.isActive).length} sesi</p>
            <p><strong>Jenis siaga tambahan:</strong> {draft.customEmergencies.filter(item => item.isActive).length} aktif</p>
          </div>
        </div>
      </> : <>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button type="button" onClick={cancel} disabled={saving} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-700 min-h-10 focus-visible:outline-2 focus-visible:outline-cyan-500"><ArrowLeft className="w-4 h-4"/> Kembali ke kategori</button>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${dirty ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{dirty ? 'Perubahan belum disimpan' : 'Belum ada perubahan'}</span>
          </div>
          <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-700 dark:bg-slate-700 dark:text-cyan-200 grid place-items-center shrink-0">{React.createElement(selectedSection.icon, { className: "w-5 h-5" })}</span><div className="min-w-0"><h4 className="font-bold text-base text-slate-900 dark:text-white">{selectedSection.title}</h4><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{selectedSection.description}</p></div></div>
          <div className="sm:hidden"><label htmlFor="emergency-config-section" className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">Pindah kategori pengaturan</label><select id="emergency-config-section" value={tab} onChange={e => setTab(e.target.value as Tab)} className={inputStyle}>{sections.map(section => <option key={section.key} value={section.key}>{section.title}</option>)}</select></div>
          <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-3 gap-2" role="tablist" aria-label="Kategori konfigurasi Pusat Komando">
            {sections.map(({key,title}) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 py-2 px-3 rounded-xl text-xs text-left font-semibold border transition-colors ${tab === key ? 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800' : 'bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-300'}`}>{title}</button>)}
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Ubah kolom di bawah. <strong>Uji suara</strong> hanya berbunyi di perangkat ini, sedangkan jadwal bel merupakan referensi, bukan pemicu siaran otomatis.</div>
      {tab === 'command' && <div className="space-y-3">
        <label className="block"><span className={labelStyle}>Judul Pusat Komando</span><input disabled={!editing} maxLength={90} className={inputStyle} value={draft.heading} onChange={e => change({ heading: e.target.value })}/></label>
        <label className="block"><span className={labelStyle}>Deskripsi halaman</span><textarea disabled={!editing} maxLength={260} rows={3} className={inputStyle} value={draft.description} onChange={e => change({ description: e.target.value })}/></label>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 space-y-3">
          <h4 className="font-bold text-sm">Lokasi Posko / Pusat Komando</h4>
          <p className="text-xs text-slate-500">Lokasi ini ditampilkan langsung di layar Pusat Komando dan petunjuk operator. Bukan koordinat GPS presensi.</p>
          <label className="block"><span className={labelStyle}>Lokasi utama / nama ruangan</span><input disabled={!editing} maxLength={90} className={inputStyle} value={draft.commandPost.primary} onChange={e => changePost({primary:e.target.value})} placeholder="Contoh: Ruang Tata Usaha"/></label>
          <label className="block"><span className={labelStyle}>Petunjuk alamat / lantai</span><textarea disabled={!editing} maxLength={200} rows={2} className={inputStyle} value={draft.commandPost.details} onChange={e => changePost({details:e.target.value})} placeholder="Contoh: Gedung A, lantai dasar"/></label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block"><span className={labelStyle}>Posko alternatif (opsional)</span><input disabled={!editing} maxLength={90} className={inputStyle} value={draft.commandPost.alternate} onChange={e => changePost({alternate:e.target.value})}/></label>
            <label className="block"><span className={labelStyle}>Titik kumpul (opsional)</span><input disabled={!editing} maxLength={120} className={inputStyle} value={draft.commandPost.assemblyPoint} onChange={e => changePost({assemblyPoint:e.target.value})}/></label>
          </div>
          <label className="block"><span className={labelStyle}>Arahan menuju posko</span><textarea disabled={!editing} maxLength={300} rows={2} className={inputStyle} value={draft.commandPost.instructions} onChange={e => changePost({instructions:e.target.value})}/></label>
        </div>
      </div>}
      {tab === 'bell' && <div className="space-y-3">
        <p className="text-xs text-slate-500">Edit nama bel manual di Pusat Komando. Jenis suara tetap mengikuti nada bawaan aplikasi.</p>
        {SCHOOL_BELL_KINDS.map(kind => <div key={kind} className="flex flex-col sm:flex-row sm:items-end gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <label className="flex-1 block"><span className={labelStyle}>{kind.replace('_',' ')}</span><input disabled={!editing} maxLength={45} className={inputStyle} value={draft.bellLabels[kind]} onChange={e => change({ bellLabels: { ...draft.bellLabels, [kind]: e.target.value } })} /></label>
          <Button type="button" size="sm" variant="outline" leftIcon={<Volume2 className="w-4 h-4" />} onClick={BELLS[kind]}>Uji Suara Lokal</Button>
        </div>)}
      </div>}
      {tab === 'schedule' && <div className="space-y-3">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <strong>Jadwal referensi, bukan pemutar otomatis.</strong> Jam, hari, nama, dan nada disimpan di Firebase serta ditampilkan realtime. Bunyi bel hanya diputar saat operator menekan tombol uji/manual; jadwal ini belum menyalakan speaker sekolah secara otomatis.
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{draft.scheduledBells.length} sesi bel (maksimal 20)</span>
          {editing && <Button type="button" size="sm" variant="outline" disabled={saving || draft.scheduledBells.length >= 20} onClick={addBell} leftIcon={<Plus className="w-4 h-4"/>}>Tambah Sesi</Button>}
        </div>
        {draft.scheduledBells.map((bell, index) => <div key={bell.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={bell.isActive} disabled={!editing} onChange={e => editBell(bell.id, {isActive: e.target.checked})} className="w-4 h-4"/> Sesi {index + 1} {bell.isActive ? '· Aktif' : '· Nonaktif'}</label>
            {editing && <button type="button" className="min-h-10 min-w-10 p-2 rounded-lg text-rose-600 border border-rose-200 flex items-center justify-center" aria-label={`Hapus sesi ${bell.label}`} title="Hapus sesi jadwal bel" onClick={() => change({scheduledBells: draft.scheduledBells.filter(b => b.id !== bell.id)})}><Trash2 className="w-4 h-4" /></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className={labelStyle}>Jam WIB</span><input type="time" disabled={!editing} value={bell.time} onChange={e => editBell(bell.id, {time:e.target.value})} className={inputStyle}/></label>
            <label className="block"><span className={labelStyle}>Nada bel</span><select disabled={!editing} value={bell.toneType} onChange={e => editBell(bell.id, {toneType:e.target.value as typeof bell.toneType})} className={inputStyle}>{BELL_TONE_TYPES.map(tone => <option key={tone} value={tone}>{tone.replaceAll('_',' ')}</option>)}</select></label>
          </div>
          <label className="block"><span className={labelStyle}>Nama sesi</span><input disabled={!editing} maxLength={75} value={bell.label} onChange={e => editBell(bell.id, {label:e.target.value})} className={inputStyle}/></label>
          <label className="block"><span className={labelStyle}>Keterangan</span><input disabled={!editing} maxLength={160} value={bell.description} onChange={e => editBell(bell.id, {description:e.target.value})} className={inputStyle}/></label>
          <fieldset><legend className={labelStyle}>Hari berlaku</legend><div className="flex gap-1.5 flex-wrap">
            {BELL_WEEKDAYS.map(day => <label key={day} className={`min-w-10 min-h-10 px-2 inline-flex items-center justify-center text-xs font-semibold rounded-lg border cursor-pointer ${bell.days.includes(day) ? 'bg-[var(--theme-primary-light)] border-[var(--theme-primary-border)]' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="checkbox" className="sr-only" checked={bell.days.includes(day)} disabled={!editing} onChange={e => editBell(bell.id, {days: e.target.checked ? [...bell.days,day].sort((a,b)=>a-b) : bell.days.filter(d=>d!==day)})} />{BELL_DAY_LABELS[day]}
            </label>)}
          </div></fieldset>
          <Button type="button" variant="outline" size="sm" leftIcon={<Volume2 className="w-4 h-4"/>} onClick={() => SchoolBellService.playToneByType(bell.toneType)}>Uji Suara di Perangkat Ini</Button>
        </div>)}
        {!draft.scheduledBells.length && <p className="text-xs text-slate-500">Belum ada sesi bel. Gunakan Tambah Sesi dalam mode edit.</p>}
      </div>}
      {tab === 'emergency' && <div className="space-y-4">
        <div className="p-3 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0"/> Pengaturan ini hanya mengubah isi kartu, petunjuk operator, dan pesan awal. <strong>Tidak mengirim siaran.</strong> Aktivasi darurat tetap membutuhkan tindakan dan konfirmasi terpisah.</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Pilih jenis siaga untuk diatur">
          {EMERGENCY_TYPES.map(type => <button key={type} type="button" onClick={() => setSelectedEmergency(type)} aria-pressed={selectedEmergency===type} className={`min-h-11 px-3 rounded-xl text-xs font-semibold border ${selectedEmergency===type ? 'bg-[var(--theme-primary-light)] border-[var(--theme-primary-border)] text-[var(--theme-primary-text)]' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200'}`}>{TYPE_LABELS[type]}</button>)}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div><h4 className="font-bold text-sm">Pengaturan {TYPE_LABELS[selectedEmergency]}</h4><p className="text-xs text-slate-500">Pratinjau kartu dan informasi kerja operator untuk satu jenis kejadian.</p></div>
          <label className="block"><span className={labelStyle}>Nama tombol siaga</span><input disabled={!editing} maxLength={45} className={inputStyle} value={draft.emergencyOptions[selectedEmergency].label} onChange={e => change({ emergencyOptions: {...draft.emergencyOptions, [selectedEmergency]: {...draft.emergencyOptions[selectedEmergency], label: e.target.value}} })}/></label>
          <label className="block"><span className={labelStyle}>Keterangan singkat pada kartu</span><textarea disabled={!editing} maxLength={180} rows={2} className={inputStyle} value={draft.emergencyOptions[selectedEmergency].description} onChange={e => change({ emergencyOptions: {...draft.emergencyOptions, [selectedEmergency]: {...draft.emergencyOptions[selectedEmergency], description: e.target.value}} })}/></label>
          <label className="block"><span className={labelStyle}>Judul peringatan</span><input disabled={!editing} maxLength={80} className={inputStyle} value={draft.emergencyTemplates[selectedEmergency].title} onChange={e => change({ emergencyTemplates: { ...draft.emergencyTemplates, [selectedEmergency]: { ...draft.emergencyTemplates[selectedEmergency], title: e.target.value } } })}/></label>
          <label className="block"><span className={labelStyle}>Pesan / instruksi saat siaran</span><textarea disabled={!editing} maxLength={600} rows={3} className={inputStyle} value={draft.emergencyTemplates[selectedEmergency].message} onChange={e => change({ emergencyTemplates: { ...draft.emergencyTemplates, [selectedEmergency]: { ...draft.emergencyTemplates[selectedEmergency], message: e.target.value } } })}/></label>
          <label className="block"><span className={labelStyle}>Checklist operator (sebelum konfirmasi siaran)</span><textarea disabled={!editing} maxLength={500} rows={3} className={inputStyle} value={draft.emergencyOptions[selectedEmergency].operatorChecklist} onChange={e => change({ emergencyOptions: {...draft.emergencyOptions, [selectedEmergency]: {...draft.emergencyOptions[selectedEmergency], operatorChecklist: e.target.value}} })}/></label>
          <label className="block"><span className={labelStyle}>Kontak rujukan saat kejadian</span><select disabled={!editing} className={inputStyle} value={draft.emergencyOptions[selectedEmergency].contactId} onChange={e => change({emergencyOptions: {...draft.emergencyOptions, [selectedEmergency]: {...draft.emergencyOptions[selectedEmergency], contactId: e.target.value as typeof draft.emergencyOptions[typeof selectedEmergency]['contactId']}}})}>
            {EMERGENCY_CONTACT_IDS.map(id => { const contact = draft.emergencyContacts.find(c => c.id === id); return <option key={id} value={id}>{contact?.label || id} — {contact?.number || '-'}</option>; })}
          </select></label>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-900/40 space-y-1" aria-label="Pratinjau tombol siaga"><p className="font-bold text-sm">{draft.emergencyOptions[selectedEmergency].label || 'Nama tombol'}</p><p className="text-xs text-slate-500">{draft.emergencyOptions[selectedEmergency].description || 'Keterangan kartu belum diisi.'}</p></div>
        </div>
      </div>}
      {tab === 'additional' && <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
          Tambahkan jenis bencana sesuai kondisi sekolah, misalnya banjir atau pohon tumbang. Kartu aktif tampil realtime di Pusat Komando dan Bel & Darurat. Menyimpan pengaturan <strong>tidak menyalakan sirene atau mengirim peringatan.</strong>
          Jenis tambahan menggunakan kategori umum saat siaran, agar kompatibel dengan sistem peringatan yang sudah ada.
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-semibold">{draft.customEmergencies.length} dari 12 jenis tambahan</p>
          {admin && editing && <Button type="button" size="sm" variant="outline" disabled={saving || draft.customEmergencies.length >= 12} onClick={addScenario} leftIcon={<Plus className="w-4 h-4"/>}>Tambah Jenis Bencana</Button>}
        </div>
        {draft.customEmergencies.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex gap-2 items-center text-xs font-bold"><input type="checkbox" className="w-4 h-4" disabled={!editing} checked={item.isActive} onChange={e => updateScenario(item.id,{isActive:e.target.checked})}/> {item.isActive ? 'Aktif' : 'Nonaktif'} · Siaga {index+1}</label>
            {editing && <button type="button" aria-label={`Hapus siaga ${item.label || index + 1}`} className="min-h-10 min-w-10 text-rose-600 border border-rose-200 rounded-lg inline-flex justify-center items-center" onClick={() => change({customEmergencies:draft.customEmergencies.filter(s => s.id !== item.id)})}><Trash2 className="w-4 h-4"/></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={labelStyle}>Nama jenis kejadian</span><input disabled={!editing} maxLength={45} className={inputStyle} value={item.label} onChange={e => updateScenario(item.id,{label:e.target.value})} placeholder="Contoh: Banjir"/></label>
            <label><span className={labelStyle}>Kontak rujukan</span><select disabled={!editing} className={inputStyle} value={item.contactId} onChange={e => updateScenario(item.id,{contactId:e.target.value as typeof item.contactId})}>{EMERGENCY_CONTACT_IDS.map(id => {const contact=draft.emergencyContacts.find(c=>c.id===id);return <option key={id} value={id}>{contact?.label || id}</option>;})}</select></label>
          </div>
          <label className="block"><span className={labelStyle}>Deskripsi singkat untuk kartu</span><input disabled={!editing} maxLength={180} className={inputStyle} value={item.description} onChange={e => updateScenario(item.id,{description:e.target.value})}/></label>
          <label className="block"><span className={labelStyle}>Judul peringatan</span><input disabled={!editing} maxLength={80} className={inputStyle} value={item.title} onChange={e => updateScenario(item.id,{title:e.target.value})}/></label>
          <label className="block"><span className={labelStyle}>Pesan siaga (min. 15 karakter)</span><textarea disabled={!editing} maxLength={600} rows={3} className={inputStyle} value={item.message} onChange={e => updateScenario(item.id,{message:e.target.value})}/></label>
          <label className="block"><span className={labelStyle}>Checklist operator (min. 15 karakter)</span><textarea disabled={!editing} maxLength={500} rows={3} className={inputStyle} value={item.operatorChecklist} onChange={e => updateScenario(item.id,{operatorChecklist:e.target.value})}/></label>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-3 text-xs"><strong>Pratinjau:</strong> {item.label || 'Nama kejadian'} · {item.description || 'Deskripsi singkat'} {item.isActive ? '· Ditampilkan' : '· Disembunyikan'}</div>
        </div>)}
        {!draft.customEmergencies.length && <p className="text-xs text-slate-500">Belum ada jenis tambahan. Admin dapat menambah sesuai kondisi sekolah.</p>}
      </div>}
      {tab === 'contacts' && <div className="space-y-4">
        <p className="text-xs text-slate-500">Verifikasi nomor telepon dengan pihak sekolah/instansi sebelum digunakan dalam situasi darurat.</p>
        {draft.emergencyContacts.map((contact, index) => <div key={contact.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block"><span className={labelStyle}>Nama kontak {contact.id}</span><input disabled={!editing} maxLength={65} className={inputStyle} value={contact.label} onChange={e => change({ emergencyContacts: draft.emergencyContacts.map((c,i) => i === index ? {...c, label:e.target.value} : c) })}/></label>
          <label className="block"><span className={labelStyle}>Nomor telepon</span><input disabled={!editing} inputMode="tel" maxLength={24} className={inputStyle} value={contact.number} onChange={e => change({ emergencyContacts: draft.emergencyContacts.map((c,i) => i === index ? {...c, number:e.target.value} : c) })}/></label>
        </div>)}
        <h4 className="text-sm font-bold">Langkah Prosedur Siaga</h4>
        {draft.protocolSteps.map((step,index) => <label key={index} className="block"><span className={labelStyle}>Langkah {index+1}</span><textarea disabled={!editing} maxLength={280} rows={2} className={inputStyle} value={step} onChange={e => change({ protocolSteps: draft.protocolSteps.map((s,i) => i === index ? e.target.value : s) })}/></label>)}
      </div>}
      {message && <div role={message.error ? 'alert' : 'status'} className={`rounded-xl p-3 text-xs ${message.error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}
      {/* Keep the action bar in the document flow. Sticky positioning here caused
          jumps/overlap with the app's own sticky header while scrolling. */}
      <div
        data-emergency-save-bar
        className="relative w-full min-w-0 border-t border-slate-200 dark:border-slate-700 pt-4 sm:pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <p className="min-w-0 text-xs leading-relaxed text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
          {saving ? 'Menyimpan pengaturan ke Firebase…' : dirty ? 'Perubahan belum disimpan. Periksa formulir sebelum menyimpan.' : 'Tidak ada perubahan untuk disimpan.'}
        </p>
        <div className="flex w-full sm:w-auto shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={cancel} className="flex-1 sm:flex-none">Batal</Button>
          <Button type="button" size="sm" disabled={saving || !dirty} onClick={save} className="flex-1 sm:flex-none" leftIcon={<Save className="w-4 h-4"/>}>{saving ? 'Menyimpan…' : 'Simpan Perubahan'}</Button>
        </div>
      </div>
      </>}
    </CardContent>
  </Card>;
}
