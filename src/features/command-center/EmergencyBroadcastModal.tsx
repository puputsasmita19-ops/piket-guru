import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolBellService } from '../../services/audio/bellService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { SchoolSettings } from '../../types';
import { normalizeCommandCenterConfig } from '../../types/commandCenterConfig.types';
import {
  Siren,
  PhoneCall,
  ShieldAlert,
  Flame,
  Hospital,
  AlertTriangle,
  ExternalLink,
} from '../../components/icons';

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

  const config = normalizeCommandCenterConfig(settings.commandCenterConfig);
  const emergencyContacts = [
    {
      name: config.emergencyContacts[0].label,
      number: config.emergencyContacts[0].number,
      icon: ShieldAlert,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      name: config.emergencyContacts[1].label,
      number: config.emergencyContacts[1].number,
      icon: Hospital,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      name: config.emergencyContacts[2].label,
      number: config.emergencyContacts[2].number,
      icon: Flame,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
    {
      name: config.emergencyContacts[3].label,
      number: config.emergencyContacts[3].number,
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

        {/* R39: configurable command post and read-only emergency instructions. */}
        <section className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
          <h4 className="font-bold">Lokasi Pusat Komando</h4>
          <p className="font-semibold break-words">{config.commandPost.primary}</p>
          {config.commandPost.details && <p className="whitespace-pre-wrap break-words">{config.commandPost.details}</p>}
          {config.commandPost.alternate && <p><strong>Alternatif:</strong> {config.commandPost.alternate}</p>}
          {config.commandPost.assemblyPoint && <p><strong>Titik kumpul:</strong> {config.commandPost.assemblyPoint}</p>}
          {config.commandPost.instructions && <p className="whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{config.commandPost.instructions}</p>}
        </section>
        {config.customEmergencies.filter(item => item.isActive).length > 0 && <section className="space-y-2">
          <h4 className="text-xs font-bold">Panduan Siaga Tambahan</h4>
          {config.customEmergencies.filter(item => item.isActive).map(item => {
            const contact = config.emergencyContacts.find(c => c.id === item.contactId);
            return <details key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
              <summary className="cursor-pointer min-h-9 flex items-center font-semibold">{item.label}</summary>
              <div className="space-y-2 mt-2">
                <p className="text-slate-600 dark:text-slate-300">{item.description}</p>
                <p><strong>Pesan:</strong> {item.message}</p>
                <p className="whitespace-pre-wrap"><strong>Checklist:</strong> {item.operatorChecklist}</p>
                {contact && <p><strong>Kontak:</strong> {contact.label} · {contact.number}</p>}
              </div>
            </details>;
          })}
        </section>}

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
            {config.protocolSteps.map((step, index) => <li key={index}>{step}</li>)}
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
