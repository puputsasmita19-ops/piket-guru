import type { EmergencyType, SchoolBellScheduleItem } from './security.types';

export type SchoolBellKind = 'MASUK' | 'GANTI_JAM' | 'ISTIRAHAT' | 'PULANG';
export type EmergencyTemplate = { title: string; message: string };
export type EmergencyContactId = 'POLICE' | 'AMBULANCE' | 'FIRE' | 'BPBD';
/** Operational display and guidance; never authorizes or triggers a broadcast. */
export interface EmergencyCardOptions {
  label: string;
  description: string;
  operatorChecklist: string;
  contactId: EmergencyContactId;
}
export type EmergencyContact = { id: EmergencyContactId; label: string; number: string };
/** School-specific scenario: uses GENERAL broadcast category for compatibility with existing alert backend. */
export interface CustomEmergencyScenario {
  id: string;
  label: string;
  description: string;
  title: string;
  message: string;
  operatorChecklist: string;
  contactId: EmergencyContactId;
  isActive: boolean;
}
/** Display-only location information, not a GPS/geofence configuration. */
export interface CommandPostLocation {
  primary: string;
  details: string;
  alternate: string;
  assemblyPoint: string;
  instructions: string;
}


/** Display configuration and scheduled bell reference; no automatic sound/broadcast mechanism is triggered. */
export interface CommandCenterConfig {
  heading: string;
  description: string;
  bellLabels: Record<SchoolBellKind, string>;
  emergencyTemplates: Record<EmergencyType, EmergencyTemplate>;
  emergencyOptions: Record<EmergencyType, EmergencyCardOptions>;
  emergencyContacts: EmergencyContact[];
  customEmergencies: CustomEmergencyScenario[];
  commandPost: CommandPostLocation;
  protocolSteps: string[];
  scheduledBells: SchoolBellScheduleItem[];
  updatedAt?: string;
  updatedBy?: string;
}

export const EMERGENCY_TYPES: EmergencyType[] = ['EARTHQUAKE', 'FIRE', 'SECURITY', 'EVACUATION', 'GENERAL'];
export const EMERGENCY_CONTACT_IDS: EmergencyContactId[] = ['POLICE', 'AMBULANCE', 'FIRE', 'BPBD'];
export const SCHOOL_BELL_KINDS: SchoolBellKind[] = ['MASUK', 'GANTI_JAM', 'ISTIRAHAT', 'PULANG'];
export const BELL_TONE_TYPES: SchoolBellScheduleItem['toneType'][] = ['MORNING_IN', 'PERIOD_CHANGE', 'BREAK', 'DISMISSAL'];
export const BELL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // 0 Minggu, 1 Senin ... 6 Sabtu
export const BELL_DAY_LABELS: Record<number, string> = {0:'Min',1:'Sen',2:'Sel',3:'Rab',4:'Kam',5:'Jum',6:'Sab'};
export const DEFAULT_BELL_SCHEDULE: SchoolBellScheduleItem[] = [
  {id:'bell_1',time:'06:45',label:'Bel Masuk Sekolah & Apel Pagi',toneType:'MORNING_IN',description:'Bel masuk dan apel pagi.',isActive:true,days:[1,2,3,4,5,6]},
  {id:'bell_2',time:'07:15',label:'Penutupan Gerbang Utama',toneType:'PERIOD_CHANGE',description:'Batas toleransi kehadiran.',isActive:true,days:[1,2,3,4,5,6]},
  {id:'bell_3',time:'09:45',label:'Bel Istirahat Pertama',toneType:'BREAK',description:'Istirahat pertama.',isActive:true,days:[1,2,3,4,5,6]},
  {id:'bell_4',time:'10:15',label:'Bel Masuk Jam Pembelajaran Kedua',toneType:'PERIOD_CHANGE',description:'Pergantian sesi pembelajaran.',isActive:true,days:[1,2,3,4,5,6]},
  {id:'bell_5',time:'12:00',label:'Bel Istirahat Siang & Shalat Dzuhur',toneType:'BREAK',description:'Istirahat siang dan ibadah.',isActive:true,days:[1,2,3,4,5,6]},
  {id:'bell_6',time:'12:45',label:'Bel Masuk Sesi Pembelajaran Siang',toneType:'PERIOD_CHANGE',description:'Mulai sesi siang.',isActive:true,days:[1,2,3,4,5,6]},
  {id:'bell_7',time:'15:30',label:'Bel Pulang Sekolah',toneType:'DISMISSAL',description:'Akhir pembelajaran.',isActive:true,days:[1,2,3,4,5,6]},
];

export const DEFAULT_COMMAND_CENTER_CONFIG: CommandCenterConfig = {
  heading: 'Pusat Pengawasan Real-Time & Peta Kampus',
  description: 'Integrasi monitoring pos piket, sebaran guru siaga, lonceng bel sekolah digital, dan panggilan darurat terpadu.',
  commandPost: {
    primary: 'Belum ditetapkan', details: '', alternate: '', assemblyPoint: '',
    instructions: 'Hubungi petugas sekolah untuk memastikan lokasi posko yang aktif.',
  },
  customEmergencies: [],
  bellLabels: {
    MASUK: 'Bel Masuk Pagi', GANTI_JAM: 'Bel Ganti Jam Mapel',
    ISTIRAHAT: 'Bel Jam Istirahat', PULANG: 'Bel Pulang Sekolah',
  },
  emergencyTemplates: {
    EARTHQUAKE: { title: 'Gempa Bumi Terdeteksi', message: 'Semua warga sekolah dimohon berlindung dari benda jatuh dan ikuti instruksi evakuasi petugas menuju titik kumpul.' },
    FIRE: { title: 'Peringatan Kebakaran / Asap', message: 'Terdeteksi indikasi kebakaran. Ikuti jalur evakuasi aman dan arahan petugas; jangan gunakan lift.' },
    SECURITY: { title: 'Siaga Keamanan', message: 'Ikuti instruksi keamanan sekolah. Tetap berada di tempat aman sampai ada pemberitahuan resmi.' },
    EVACUATION: { title: 'Evakuasi Darurat', message: 'Ikuti arahan petugas dan bergerak menuju titik kumpul melalui jalur evakuasi yang telah ditentukan.' },
    GENERAL: { title: 'Pengumuman Darurat Penting', message: 'Seluruh guru piket dan koordinator dimohon segera menghubungi Pusat Komando Sekolah.' },
  },
  emergencyOptions: {
    EARTHQUAKE: {label: 'Gempa Bumi', description: 'Instruksi berlindung dan evakuasi terkoordinasi.', operatorChecklist: 'Verifikasi guncangan, amankan diri, hubungi koordinator dan ikuti arahan evakuasi resmi.', contactId: 'BPBD'},
    FIRE: {label: 'Kebakaran / Asap', description: 'Siaga kebakaran dan jalur keluar aman.', operatorChecklist: 'Verifikasi titik kejadian dari jarak aman, hubungi petugas pemadam dan arahkan ke jalur evakuasi aman.', contactId: 'FIRE'},
    SECURITY: {label: 'Siaga Keamanan', description: 'Insiden keamanan di lingkungan sekolah.', operatorChecklist: 'Konfirmasi insiden kepada penanggung jawab keamanan dan hindari mendekati sumber ancaman.', contactId: 'POLICE'},
    EVACUATION: {label: 'Evakuasi', description: 'Koordinasi perpindahan ke titik kumpul.', operatorChecklist: 'Verifikasi instruksi koordinator, jalur evakuasi dan titik kumpul yang dapat digunakan.', contactId: 'BPBD'},
    GENERAL: {label: 'Siaran Khusus', description: 'Panggilan atau pengumuman penting sekolah.', operatorChecklist: 'Periksa informasi pengumuman, sasaran penerima dan persetujuan penanggung jawab.', contactId: 'BPBD'},
  },
  emergencyContacts: [
    { id: 'POLICE', label: 'Kepolisian', number: '110' },
    { id: 'AMBULANCE', label: 'Ambulans / Medis', number: '119' },
    { id: 'FIRE', label: 'Pemadam Kebakaran', number: '113' },
    { id: 'BPBD', label: 'Panggilan Darurat / BPBD', number: '112' },
  ],
  scheduledBells: DEFAULT_BELL_SCHEDULE.map(item => ({...item, days:[...item.days]})),
  protocolSteps: [
    'Petugas piket mengamankan akses dan memastikan jalur evakuasi terbuka.',
    'Koordinator menghubungi pimpinan sekolah serta instansi terkait.',
    'Arahkan warga sekolah mengikuti jalur evakuasi ke titik kumpul aman.',
    'Lakukan pencatatan kehadiran dan laporkan perkembangan kepada koordinator.',
  ],
};

const clean = (value: unknown, fallback: string, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

/** Only read known fields from Firestore; do not render arbitrary keys or URLs. */
export function normalizeCommandCenterConfig(raw?: Partial<CommandCenterConfig> | null): CommandCenterConfig {
  const base = DEFAULT_COMMAND_CENTER_CONFIG;
  const contacts = Array.isArray(raw?.emergencyContacts) ? raw!.emergencyContacts : [];
  return {
    heading: clean(raw?.heading, base.heading, 90),
    description: clean(raw?.description, base.description, 260),
    commandPost: {
      primary: clean(raw?.commandPost?.primary, base.commandPost.primary, 90),
      details: clean(raw?.commandPost?.details, base.commandPost.details, 200),
      alternate: clean(raw?.commandPost?.alternate, base.commandPost.alternate, 90),
      assemblyPoint: clean(raw?.commandPost?.assemblyPoint, base.commandPost.assemblyPoint, 120),
      instructions: clean(raw?.commandPost?.instructions, base.commandPost.instructions, 300),
    },
    customEmergencies: (Array.isArray(raw?.customEmergencies) ? raw.customEmergencies : [])
      .slice(0, 12).filter((item): item is CustomEmergencyScenario => Boolean(item && typeof item === 'object'))
      .map((item, index) => ({
        id: clean(item.id, `scenario_${index + 1}`, 64),
        label: clean(item.label, '', 45),
        description: clean(item.description, '', 180),
        title: clean(item.title, '', 80),
        message: clean(item.message, '', 600),
        operatorChecklist: clean(item.operatorChecklist, '', 500),
        contactId: EMERGENCY_CONTACT_IDS.includes(item.contactId) ? item.contactId : 'BPBD',
        isActive: item.isActive !== false,
      })),
    bellLabels: Object.fromEntries(SCHOOL_BELL_KINDS.map(k =>
      [k, clean(raw?.bellLabels?.[k], base.bellLabels[k], 45)])) as CommandCenterConfig['bellLabels'],
    emergencyTemplates: Object.fromEntries(EMERGENCY_TYPES.map(t => [t, {
      title: clean(raw?.emergencyTemplates?.[t]?.title, base.emergencyTemplates[t].title, 80),
      message: clean(raw?.emergencyTemplates?.[t]?.message, base.emergencyTemplates[t].message, 600),
    }])) as CommandCenterConfig['emergencyTemplates'],
    emergencyOptions: Object.fromEntries(EMERGENCY_TYPES.map(type => {
      const option = raw?.emergencyOptions?.[type];
      const fallback = base.emergencyOptions[type];
      return [type, {
        label: clean(option?.label, fallback.label, 45),
        description: clean(option?.description, fallback.description, 180),
        operatorChecklist: clean(option?.operatorChecklist, fallback.operatorChecklist, 500),
        contactId: EMERGENCY_CONTACT_IDS.includes(option?.contactId as EmergencyContactId) ? option!.contactId : fallback.contactId,
      }];
    })) as CommandCenterConfig['emergencyOptions'],
    emergencyContacts: base.emergencyContacts.map(def => {
      const candidate = contacts.find(c => c?.id === def.id);
      return {
        id: def.id,
        label: clean(candidate?.label, def.label, 65),
        number: clean(candidate?.number, def.number, 24),
      };
    }),
    protocolSteps: base.protocolSteps.map((step, index) => clean(raw?.protocolSteps?.[index], step, 280)),
    // A missing field comes from pre-R23 settings: migrate to defaults. An intentionally empty array remains empty.
    scheduledBells: (Array.isArray(raw?.scheduledBells) ? raw!.scheduledBells : base.scheduledBells)
      .slice(0, 20).map((item, index) => ({
        id: clean(item?.id, `bell_${index + 1}`, 50),
        time: clean(item?.time, '', 5),
        label: clean(item?.label, '', 75),
        description: clean(item?.description, '', 160),
        toneType: BELL_TONE_TYPES.includes(item?.toneType) ? item.toneType : 'PERIOD_CHANGE',
        isActive: item?.isActive !== false,
        days: Array.isArray(item?.days) ? [...new Set(item.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a,b)=>a-b) : [],
      })).sort((a,b)=>a.time.localeCompare(b.time) || a.id.localeCompare(b.id)),
    updatedAt: raw?.updatedAt,
    updatedBy: raw?.updatedBy,
  };
}

export function validateCommandCenterConfig(config: CommandCenterConfig): string[] {
  const errors: string[] = [];
  if (!config.heading.trim() || !config.description.trim()) errors.push('Judul dan deskripsi Pusat Komando wajib diisi.');
  if (!config.commandPost.primary.trim() || config.commandPost.primary.length > 90) errors.push('Lokasi utama Pusat Komando harus diisi (maksimal 90 karakter).');
  if (config.commandPost.details.length > 200 || config.commandPost.alternate.length > 90 || config.commandPost.assemblyPoint.length > 120 || config.commandPost.instructions.length > 300) errors.push('Informasi lokasi Pusat Komando terlalu panjang.');
  if (!Array.isArray(config.customEmergencies) || config.customEmergencies.length > 12) {
    errors.push('Maksimal 12 jenis bencana tambahan.');
  } else {
    const ids = new Set<string>();
    const labels = new Set<string>(EMERGENCY_TYPES.map(type => config.emergencyOptions[type].label.trim().toLocaleLowerCase('id-ID')));
    for (const scenario of config.customEmergencies) {
      if (!/^scenario_[a-zA-Z0-9_-]{1,55}$/.test(scenario.id) || ids.has(scenario.id)) errors.push('ID jenis siaga tambahan tidak valid atau duplikat.');
      ids.add(scenario.id);
      const label = scenario.label.trim().toLocaleLowerCase('id-ID');
      if (!label || label.length > 45 || labels.has(label)) errors.push(`Nama siaga tambahan harus unik dan maksimal 45 karakter: ${scenario.label}.`);
      labels.add(label);
      if (!scenario.description.trim() || scenario.description.length > 180) errors.push(`Deskripsi ${scenario.label} harus diisi (maksimal 180 karakter).`);
      if (!scenario.title.trim() || scenario.title.length > 80 || scenario.message.trim().length < 15 || scenario.message.length > 600) errors.push(`Judul atau pesan ${scenario.label} tidak lengkap.`);
      if (scenario.operatorChecklist.trim().length < 15 || scenario.operatorChecklist.length > 500) errors.push(`Checklist ${scenario.label} minimal 15 karakter.`);
      if (!EMERGENCY_CONTACT_IDS.includes(scenario.contactId)) errors.push(`Kontak siaga ${scenario.label} tidak tersedia.`);
    }
  }
  for (const kind of SCHOOL_BELL_KINDS) {
    if (!config.bellLabels[kind]?.trim()) errors.push(`Nama bel ${kind} harus diisi.`);
  }
  for (const type of EMERGENCY_TYPES) {
    const template = config.emergencyTemplates[type];
    if (!template.title.trim() || template.message.trim().length < 15) errors.push(`Judul/pesan siaga ${type} harus lengkap (pesan minimal 15 karakter).`);
  }
  for (const type of EMERGENCY_TYPES) {
    const option = config.emergencyOptions?.[type];
    if (!option?.label.trim() || option.label.length > 45 || !option.description.trim() || option.description.length > 180) errors.push(`Nama dan deskripsi tombol ${type} harus diisi.`);
    if (!option?.operatorChecklist || option.operatorChecklist.trim().length < 15 || option.operatorChecklist.length > 500) errors.push(`Checklist operator ${type} minimal 15 karakter.`);
    if (!option || !EMERGENCY_CONTACT_IDS.includes(option.contactId)) errors.push(`Kontak rujukan ${type} tidak valid.`);
  }
  for (const contact of config.emergencyContacts) {
    // tel: only allows numeric dialing characters; no URLs or control characters.
    if (!contact.label.trim() || !/^\+?[0-9][0-9\s()-]{1,22}$/.test(contact.number)) errors.push(`Kontak ${contact.id}: nama dan nomor telepon harus valid.`);
  }
  if (config.protocolSteps.some(step => step.trim().length < 10)) errors.push('Setiap langkah SOP minimal 10 karakter.');
  if (!Array.isArray(config.scheduledBells) || config.scheduledBells.length > 20) {
    errors.push('Daftar bel harus berupa maksimal 20 sesi.');
  } else {
    const ids = new Set<string>();
    const slotByDay = new Set<string>();
    for (const bell of config.scheduledBells) {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(bell.time)) errors.push(`Jam bel ${bell.label || bell.id} harus HH:mm (00:00–23:59).`);
      if (!bell.id || ids.has(bell.id)) errors.push('ID sesi bel tidak boleh kosong atau duplikat.');
      ids.add(bell.id);
      if (!bell.label.trim() || bell.label.length > 75 || bell.description.length > 160) errors.push(`Nama/keterangan bel ${bell.id} tidak valid.`);
      if (!BELL_TONE_TYPES.includes(bell.toneType)) errors.push(`Nada bel ${bell.id} tidak didukung.`);
      if (!Array.isArray(bell.days) || bell.days.length === 0 || bell.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) errors.push(`Pilih minimal satu hari untuk bel ${bell.label || bell.id}.`);
      if (bell.isActive && Array.isArray(bell.days)) for (const day of bell.days) {
        const key = `${day}:${bell.time}`;
        if (slotByDay.has(key)) errors.push(`Dua sesi bel aktif bentrok pada hari ${BELL_DAY_LABELS[day]} pukul ${bell.time}.`);
        slotByDay.add(key);
      }
    }
  }
  return errors;
}
