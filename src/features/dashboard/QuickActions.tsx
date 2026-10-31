import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../config/permissions';
import type { NavigationTab } from '../../types';
import { getModuleStyle } from '../../config/moduleAppearance';
import { MapPin, BookOpenCheck, ClockCountdown, DoorOpen, AlertTriangle, UserCheck, CalendarDays, UserSwitch, FileBarChart2, Users, Settings, Radio, Tv, Edit2, Plus, Check, ChevronUp, ChevronDown } from '../../components/icons';
import { FeatureIllustration } from '../../components/common/FeatureIllustration';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { loadShortcutIds, saveShortcutIds, sanitizeShortcutIds } from '../../services/preferences/shortcutPreferences';
import firebaseConfig from '../../../firebase-applet-config.json';

export const SHORTCUT_ACTIONS = [
  { tab: 'attendance', title: 'Presensi GPS', description: 'Masuk & pulang', icon: MapPin, permission: PERMISSIONS.ATTENDANCE_VIEW },
  { tab: 'duty-book', title: 'Buku piket', description: 'Catatan kegiatan', icon: BookOpenCheck, permission: PERMISSIONS.DUTYBOOK_VIEW },
  { tab: 'student-tardiness', title: 'Siswa terlambat', description: 'Data keterlambatan', icon: ClockCountdown, permission: PERMISSIONS.STUDENT_TARDY_VIEW },
  { tab: 'student-permits', title: 'Izin siswa', description: 'Keluar & kembali', icon: DoorOpen, permission: PERMISSIONS.STUDENT_PERMITS_VIEW },
  { tab: 'incidents', title: 'Laporan kejadian', description: 'Kejadian di sekolah', icon: AlertTriangle, permission: PERMISSIONS.INCIDENT_VIEW },
  { tab: 'visitors', title: 'Buku tamu', description: 'Kunjungan sekolah', icon: UserCheck, permission: PERMISSIONS.VISITORS_VIEW },
  { tab: 'schedules', title: 'Jadwal piket', description: 'Lihat penugasan', icon: CalendarDays, permission: PERMISSIONS.SCHEDULE_VIEW },
  { tab: 'substitutions', title: 'Guru pengganti', description: 'Penugasan inval', icon: UserSwitch, permission: PERMISSIONS.SUBSTITUTIONS_VIEW },
  { tab: 'reports', title: 'Laporan & rekap', description: 'Ringkasan & foto', icon: FileBarChart2, permission: PERMISSIONS.REPORTS_VIEW },
  { tab: 'users', title: 'Master pengguna', description: 'Kelola data sekolah', icon: Users, permission: PERMISSIONS.USERS_VIEW },
  { tab: 'settings', title: 'Pengaturan', description: 'Preferensi sekolah', icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
  { tab: 'command-center', title: 'Pusat komando', description: 'Pantau operasional', icon: Radio, permission: PERMISSIONS.COMMAND_CENTER_VIEW },
  { tab: 'kiosk', title: 'TV lobi', description: 'Layar informasi', icon: Tv, permission: PERMISSIONS.KIOSK_VIEW },
] as const;
const KNOWN_IDS = SHORTCUT_ACTIONS.map(action => action.tab);
const DEFAULT_IDS = KNOWN_IDS.slice(0, 6);
const MAX_SHORTCUTS = 8;

export const QuickActions = React.memo(function QuickActions({ onNavigate }: { onNavigate: (tab: NavigationTab) => void }) {
  const { currentUser, hasPermission, isTrustedDevice } = useAuth();
  const uid = currentUser?.id || '';
  const project = firebaseConfig.projectId;
  const available = SHORTCUT_ACTIONS.filter(action => hasPermission(action.permission));
  const defaults = DEFAULT_IDS.filter(id => available.some(a => a.tab === id));
  const defaultIds = defaults.length ? defaults : available.slice(0, 6).map(a => a.tab);
  const [preference, setPreference] = useState<{ uid: string; ids: string[] | null }>(() => ({ uid, ids: loadShortcutIds(project, uid, isTrustedDevice, KNOWN_IDS) }));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const allowedIdsKey = available.map(action => action.tab).join('|');
  useEffect(() => { setDraft(previous => previous.filter(id => allowedIdsKey.split('|').includes(id))); }, [allowedIdsKey]);
  useEffect(() => {
    setPreference({ uid, ids: loadShortcutIds(project, uid, isTrustedDevice, KNOWN_IDS) });
    setEditing(false); setFeedback('');
  }, [uid, project, isTrustedDevice]);
  const selectedIds = (preference.uid === uid && preference.ids !== null ? preference.ids : defaultIds).filter(id => available.some(a => a.tab === id));
  const visible = selectedIds.map(id => available.find(action => action.tab === id)!).filter(Boolean);
  const openEditor = () => { setDraft([...selectedIds]); setFeedback(''); setEditing(true); };
  const toggle = (id: string) => setDraft(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < MAX_SHORTCUTS ? [...previous, id] : previous);
  const move = (id: string, direction: -1 | 1) => setDraft(previous => {
    const index = previous.indexOf(id), next = index + direction;
    if (index < 0 || next < 0 || next >= previous.length) return previous;
    const copy = [...previous]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy;
  });
  const save = () => {
    const safe = sanitizeShortcutIds(draft, available.map(a => a.tab));
    const persisted = saveShortcutIds(project, uid, isTrustedDevice, safe, KNOWN_IDS);
    setPreference({ uid, ids: safe }); setEditing(false);
    setFeedback(persisted ? 'Pintasan Anda diperbarui.' : 'Pintasan diterapkan untuk sesi ini. Penyimpanan browser tidak tersedia.');
  };
  const editorActions = [...draft.flatMap(id => { const action = available.find(item => item.tab === id); return action ? [action] : []; }), ...available.filter(action => !draft.includes(action.tab))];
  if (!available.length) return null;
  return <section aria-labelledby="quick-actions-heading" data-tour="quick-actions" className="shortcut-section">
    <div className="shortcut-section-heading"><div><h2 id="quick-actions-heading">Pintasan Anda</h2><p>Yang paling sering Anda gunakan.</p></div>
      <button type="button" onClick={openEditor} className="shortcut-edit" aria-label="Edit pintasan"><Edit2 className="w-3.5 h-3.5" />Edit</button>
    </div>
    {feedback && <p role="status" className="text-xs text-[var(--theme-primary-text)] mb-3">{feedback}</p>}
    <div className="shortcut-grid">
      {visible.map(({ tab, title, description, icon: Icon, permission }) => <button key={tab} type="button" onClick={() => { if (hasPermission(permission)) onNavigate(tab); }} aria-label={`Buka ${title}`}
        data-module={tab} style={getModuleStyle(tab)} className="quick-action shortcut-tile">
        <FeatureIllustration module={tab} icon={Icon} />
        <span className="shortcut-tile-title">{title}</span><span className="module-description shortcut-tile-description">{description}</span>
      </button>)}
      {visible.length < Math.min(available.length, MAX_SHORTCUTS) && <button type="button" onClick={openEditor} className="shortcut-add" aria-label="Tambah pintasan"><span className="shortcut-add-icon"><Plus className="w-5 h-5" /></span><span><strong>Tambah pintasan</strong><span>Atur menu sesuai kebutuhan Anda</span></span></button>}
    </div>
    <Modal isOpen={editing} onClose={() => setEditing(false)} title="Atur pintasan Anda" maxWidth="xl" footer={<div className="flex gap-2 w-full sm:justify-end"><Button variant="outline" onClick={() => setEditing(false)}>Batal</Button><Button onClick={save}>Simpan pintasan</Button></div>}>
      <div className="shortcut-editor">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Pilih hingga 8 menu. Gunakan panah untuk mengatur urutannya. Pengaturan ini hanya untuk akun Anda di browser ini.</p>
        <div className="flex items-center justify-between gap-2 py-2"><span aria-live="polite" className="text-xs font-semibold text-[var(--theme-primary-text)]">{draft.length} dari 8 dipilih</span><button type="button" className="shortcut-edit" onClick={() => setDraft([...defaultIds])}>Urutan awal</button></div>
        <div className="space-y-2">{editorActions.map(action => {
          const index = draft.indexOf(action.tab), chosen = index >= 0;
          return <div key={action.tab} data-module={action.tab} style={getModuleStyle(action.tab)} className={`shortcut-editor-row ${chosen ? 'is-selected' : ''}`}>
            <label className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer min-h-12"><input type="checkbox" checked={chosen} disabled={!chosen && draft.length >= MAX_SHORTCUTS} onChange={() => toggle(action.tab)} className="w-4 h-4 shrink-0 accent-[var(--theme-primary)]" /><span className="module-icon p-2 rounded-xl"><action.icon className="w-5 h-5" /></span><span className="text-sm font-semibold min-w-0">{action.title}</span></label>
            {chosen && <><span className="shortcut-order" aria-label={`Urutan ${index + 1}`}>{index + 1}</span><div className="flex"><button type="button" aria-label={`Naikkan ${action.title}`} disabled={index === 0} onClick={() => move(action.tab, -1)} className="shortcut-order-button"><ChevronUp className="w-4 h-4" /></button><button type="button" aria-label={`Turunkan ${action.title}`} disabled={index === draft.length - 1} onClick={() => move(action.tab, 1)} className="shortcut-order-button"><ChevronDown className="w-4 h-4" /></button></div></>}
          </div>;
        })}</div>
      </div>
    </Modal>
  </section>;
});
