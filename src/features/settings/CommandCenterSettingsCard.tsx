import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Save, Edit2, ShieldAlert, Volume2, Plus, Trash2 } from '../../components/icons';
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
    const frame = requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
  const beginEdit = () => {
    const next = normalizeCommandCenterConfig(settings.commandCenterConfig);
    setOriginal(next); setDraft(next); setMessage(null); setEditing(true);
  };
  const cancel = () => { setDraft(original); setEditing(false); setMessage(null); };
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
    <CardHeader title="Edit Bel Darurat & Pusat Komando" subtitle="Kelola lokasi posko, kategori bencana tambahan, bel, pesan siaga, kontak, dan SOP (khusus Administrator)." />
    <CardContent className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl">Pengaturan tersimpan realtime di Firebase, termasuk jadwal bel referensi. <strong>Uji suara hanya di perangkat ini</strong>; tombolnya tidak mengirim siaran ke pengguna lain.</p>
        {admin && !editing && <Button size="sm" variant="outline" leftIcon={<Edit2 className="w-4 h-4" />} onClick={beginEdit}>Edit Pengaturan</Button>}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Kategori konfigurasi Pusat Komando">
        {([['command','Pusat Komando'],['bell','Bel Manual'],['schedule','Jadwal Bel'],['emergency','Pesan Darurat'],['additional','Jenis Bencana +'],['contacts','Kontak & SOP']] as [Tab,string][]).map(([key,title]) =>
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`shrink-0 min-h-10 px-3 rounded-xl text-xs font-bold border ${tab === key ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)]' : 'text-slate-500 border-slate-200 dark:border-slate-700'}`}>{title}</button>)}
      </div>
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
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Pilih jenis siaga untuk diatur">
          {EMERGENCY_TYPES.map(type => <button key={type} type="button" onClick={() => setSelectedEmergency(type)} aria-pressed={selectedEmergency===type} className={`min-h-11 px-3 shrink-0 rounded-xl text-xs font-semibold border ${selectedEmergency===type ? 'bg-[var(--theme-primary-light)] border-[var(--theme-primary-border)] text-[var(--theme-primary-text)]' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200'}`}>{TYPE_LABELS[type]}</button>)}
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
      {message && <div role={message.error ? 'alert' : 'status'} className={`p-3 rounded-xl text-xs ${message.error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}
      {editing && <div className="flex flex-wrap justify-end gap-2 border-t pt-4 border-slate-200 dark:border-slate-700">
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={cancel}>Batal Edit</Button>
        <Button type="button" size="sm" disabled={saving} onClick={save} leftIcon={<Save className="w-4 h-4"/>}>{saving ? 'Menyimpan…' : 'Simpan Semua Pengaturan'}</Button>
      </div>}
    </CardContent>
  </Card>;
}
