import { ScheduleItem, SchoolSettings } from '../../types';
import { IncidentRecord } from '../../types/incident.types';
import { formatIndonesianDate } from '../../utils/dateUtils';

export class WhatsAppService {
  /**
   * Cleans phone number to international WhatsApp format (e.g. 0812... -> 62812...)
   */
  public static formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
      cleaned = '62' + cleaned;
    }
    return cleaned;
  }

  /**
   * Generates WhatsApp Click-to-Chat URL
   */
  public static generateWhatsAppLink(phone: string, message: string): string {
    const formattedPhone = this.formatPhoneNumber(phone);
    const encodedMessage = encodeURIComponent(message.trim());
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }

  /**
   * Template for Schedule Duty Reminder
   */
  public static getScheduleReminderMessage(
    schedule: ScheduleItem,
    schoolName: string
  ): string {
    return `*PEMBERITAHUAN TUGAS PIKET SEKOLAH*
Halo Bapak/Ibu *${schedule.petugasName}*,

Mengingatkan jadwal tugas piket Anda di *${schoolName}*:
📅 *Hari/Tanggal:* ${schedule.hari}, ${formatIndonesianDate(schedule.tanggal)}
⏰ *Waktu Shift:* ${schedule.jamMulai} - ${schedule.jamSelesai} WIB
📍 *Pos/Lokasi:* ${schedule.ruangName}

Mohon hadir tepat waktu dan melakukan Presensi GPS & Swafoto melalui aplikasi Piket Guru Digital.
Terima kasih atas dedikasi dan kerjasamanya. 🙏`;
  }

  /**
   * Template for Incident Notification to Parents or Class Advisor
   */
  public static getIncidentNoticeMessage(
    incident: IncidentRecord,
    schoolName: string
  ): string {
    return `*INFORMASI DARI TIM PIKET SEKOLAH*
*${schoolName}*

Yth. Bapak/Ibu,
Melalui pesan ini kami menginformasikan catatan kejadian siswa/i:
📅 *Waktu:* ${formatIndonesianDate(incident.tanggal)} (${incident.waktu} WIB)
📍 *Lokasi:* ${incident.lokasi}
👤 *Pihak/Siswa:* ${incident.pihakTerlibat}
⚠️ *Kategori:* ${incident.kategoriName} (${incident.tingkatKeparahan})

📝 *Uraian:*
${incident.uraian}

🩺 *Tindakan Penanganan:*
${incident.tindakanAwal}

👤 *Petugas Piket:* ${incident.penanggungJawab}
Mohon kerja sama dan koordinasinya. Terima kasih.`;
  }
}
