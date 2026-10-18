export const WELCOME_CATEGORIES = {
  all: 'Semua kategori', general: 'Umum', islamic: 'Islami',
  motivation: 'Motivasi', inspiration: 'Inspirasi', humor: 'Jenaka',
} as const;
export type WelcomeCategory = keyof typeof WELCOME_CATEGORIES;
export const WELCOME_INTERVALS = [5, 15, 30, 60] as const;
export const WELCOME_TEMPLATES = [
  { id: 'general-smooth', category: 'general', text: 'Semoga kegiatan sekolah hari ini berjalan lancar.' },
  { id: 'general-team', category: 'general', text: 'Selamat bertugas. Mari jaga sekolah tetap aman, tertib, dan nyaman.' },
  { id: 'general-help', category: 'general', text: 'Terima kasih sudah hadir dan membantu kegiatan sekolah hari ini.' },
  { id: 'islamic-ease', category: 'islamic', text: 'Bismillah, semoga Allah memudahkan tugas dan memberi keberkahan hari ini.' },
  { id: 'islamic-intention', category: 'islamic', text: 'Awali tugas dengan niat baik. Semoga setiap bantuan menjadi amal kebaikan.' },
  { id: 'islamic-grateful', category: 'islamic', text: 'Alhamdulillah atas kesempatan hari ini. Mari bertugas dengan ikhlas dan penuh syukur.' },
  { id: 'motivation-small', category: 'motivation', text: 'Langkah kecil yang konsisten membantu menciptakan sekolah yang lebih baik.' },
  { id: 'motivation-spirit', category: 'motivation', text: 'Semangat bertugas! Kehadiran dan kepedulian Anda berarti bagi banyak orang.' },
  { id: 'motivation-start', category: 'motivation', text: 'Mulai dari yang bisa dilakukan hari ini, lalu kerjakan dengan sepenuh hati.' },
  { id: 'inspiration-example', category: 'inspiration', text: 'Keteladanan sederhana hari ini bisa menjadi inspirasi besar bagi siswa.' },
  { id: 'inspiration-listen', category: 'inspiration', text: 'Satu sapaan ramah dan kesediaan mendengar dapat membuat hari seseorang lebih baik.' },
  { id: 'inspiration-grow', category: 'inspiration', text: 'Sekolah yang nyaman tumbuh dari kerja sama dan kepedulian kita bersama.' },
  { id: 'humor-smile', category: 'humor', text: 'Senyum dulu, baru buka jadwal. Semoga hari ini lebih lancar daripada sinyal Wi-Fi!' },
  { id: 'humor-calm', category: 'humor', text: 'Jadwal boleh padat, hati tetap santai. Satu tugas selesai, satu senyum bertambah.' },
  { id: 'humor-coffee', category: 'humor', text: 'Kopi boleh menunggu, senyum jangan. Selamat bertugas dan tetap semangat!' },
] as const;
export interface DashboardWelcomeConfig {
  enabled: boolean;
  mode: 'fixed' | 'daily' | 'interval' | 'custom';
  category: WelcomeCategory;
  templateId: string;
  customMessage: string;
  intervalMinutes: number;
}
export function sanitizeDashboardWelcomeConfig(value?: Partial<DashboardWelcomeConfig> | null): DashboardWelcomeConfig {
  const v = value && typeof value === 'object' ? value : {};
  return {
    enabled: v.enabled !== false,
    mode: ['fixed', 'daily', 'interval', 'custom'].includes(v.mode!) ? v.mode! : 'fixed',
    category: Object.hasOwn(WELCOME_CATEGORIES, v.category || '') ? v.category! : 'all',
    templateId: WELCOME_TEMPLATES.some(t => t.id === v.templateId) ? v.templateId! : WELCOME_TEMPLATES[0].id,
    customMessage: typeof v.customMessage === 'string' ? v.customMessage.replace(/\s+/g, ' ').trim().slice(0, 180) : '',
    intervalMinutes: WELCOME_INTERVALS.includes(v.intervalMinutes as typeof WELCOME_INTERVALS[number]) ? v.intervalMinutes! : 15,
  };
}
const wibParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
/** Local calculation only: rotation never writes to Firestore or starts a listener. */
export function getDashboardWelcome(value?: Partial<DashboardWelcomeConfig> | null, now: Date | number = Date.now()) {
  const config = sanitizeDashboardWelcomeConfig(value);
  const parts = Object.fromEntries(wibParts.formatToParts(now).map(p => [p.type, p.value]));
  const hour = Number(parts.hour);
  const greeting = `Selamat ${hour >= 4 && hour < 11 ? 'pagi' : hour >= 11 && hour < 15 ? 'siang' : hour >= 15 && hour < 18 ? 'sore' : 'malam'}`;
  let message: string = WELCOME_TEMPLATES.find(t => t.id === config.templateId)!.text;
  if (config.mode === 'custom') message = config.customMessage || WELCOME_TEMPLATES[0].text;
  if (config.mode === 'daily' || config.mode === 'interval') {
    const pool = WELCOME_TEMPLATES.filter(t => config.category === 'all' || t.category === config.category);
    const day = Math.floor(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000);
    const slot = config.mode === 'daily' ? day : day * (1440 / config.intervalMinutes) + Math.floor((hour * 60 + Number(parts.minute)) / config.intervalMinutes);
    message = pool[slot % pool.length].text;
  }
  return { greeting, message: config.enabled ? message : '' };
}
