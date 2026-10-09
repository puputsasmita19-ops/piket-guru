import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolBellService } from '../../services/audio/bellService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { SchoolSettings } from '../../types';
import {
  Siren,
  PhoneCall,
  ShieldAlert,
  Flame,
  Hospital,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface EmergencyBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
}

export const EmergencyBroadcastModal: React.FC<EmergencyBroadcastModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const [isPlayingSiren, setIsPlayingSiren] = useState(false);

  const emergencyContacts = [
    {
      name: 'Polsek Setempat (Kepolisian)',
      number: '110',
      icon: ShieldAlert,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      name: 'Puskesmas / Ambulans Gawat Darurat',
      number: '119',
      icon: Hospital,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      name: 'Pemadam Kebakaran (Damkar)',
      number: '113',
      icon: Flame,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
    {
      name: 'Badan Penanggulangan Bencana (BPBD)',
      number: '112',
      icon: Siren,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
  ];

  const handleTriggerSiren = () => {
    SchoolBellService.playEmergencyAlarm();
    setIsPlayingSiren(true);
    setTimeout(() => setIsPlayingSiren(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prosedur Siaga & Kontak Darurat Sekolah"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* EMERGENCY SIREN BANNER */}
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center animate-pulse">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                Bunyikan Alarm Siaga Darurat
              </h4>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Aktivasi sinyal suara evakuasi / peringatan bahaya sekolah
              </p>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            isLoading={isPlayingSiren}
            onClick={handleTriggerSiren}
          >
            Bunyikan Sirine
          </Button>
        </div>

        {/* EMERGENCY HOTLINES */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
            <span>Panggilan Cepat Instansi Terkait (Hotline 24 Jam)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {emergencyContacts.map((contact, idx) => {
              const Icon = contact.icon;
              return (
                <a
                  key={idx}
                  href={`tel:${contact.number}`}
                  className="p-3 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] hover:border-[var(--theme-primary)] transition-all flex items-center justify-between gap-2 text-xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${contact.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {contact.name}
                      </div>
                      <div className="font-mono text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-bold">
                        Panggilan: {contact.number}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--theme-primary)] transition-colors" />
                </a>
              );
            })}
          </div>
        </div>

        {/* SOP EMERGENCY PROTOCOL */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/40 border border-slate-200 dark:border-[var(--theme-card-border)] text-xs space-y-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Protokol Tanggap Darurat Tim Piket Sekolah:</span>
          </span>
          <ol className="list-decimal list-inside text-slate-600 dark:text-slate-400 space-y-1 text-[11px] leading-relaxed">
            <li>Petugas piket pos gerbang segera amankan akses keluar masuk sekolah.</li>
            <li>Koordinator piket menghubungi Kepala Sekolah dan instansi darurat terkait.</li>
            <li>Arahkan seluruh guru dan siswa menuju titik kumpul (*Assembly Point*) lapangan utama.</li>
            <li>Bawa buku presensi dan log insiden untuk verifikasi kelengkapan personil.</li>
          </ol>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
