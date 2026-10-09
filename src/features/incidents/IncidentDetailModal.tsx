import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { IncidentRecord, IncidentStatus, getIncidentCategoryDisplay } from '../../types/incident.types';
import { SchoolSettings } from '../../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';
import {
  AlertTriangle,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  Image as ImageIcon,
  ShieldCheck,
  Edit2,
  MessageSquare,
} from 'lucide-react';

interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentRecord | null;
  onStatusChange: (incidentId: string, status: IncidentStatus, note?: string) => Promise<void>;
  onEdit: (incident: IncidentRecord) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incident,
  onStatusChange,
  onEdit,
}) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isWaOpen, setIsWaOpen] = useState(false);

  if (!incident) return null;

  const handleUpdateStatus = async (newStatus: IncidentStatus) => {
    setIsSubmitting(true);
    try {
      await onStatusChange(incident.id, newStatus, resolutionNote || undefined);
      setResolutionNote('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const waMessage = WhatsAppService.getIncidentNoticeMessage(
    incident,
    DEFAULT_SCHOOL_SETTINGS.schoolName
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Detail Laporan Insiden: ${getIncidentCategoryDisplay(incident)}`}
        maxWidth="2xl"
      >
        <div className="space-y-5">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  incident.tingkatKeparahan === 'KRITIS'
                    ? 'danger'
                    : incident.tingkatKeparahan === 'TINGGI'
                    ? 'warning'
                    : 'info'
                }
                size="md"
              >
                Tingkat: {incident.tingkatKeparahan}
              </Badge>
              <Badge
                variant={
                  incident.status === 'SELESAI'
                    ? 'success'
                    : incident.status === 'PENANGANAN'
                    ? 'warning'
                    : 'primary'
                }
                size="md"
              >
                Status: {incident.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                onClick={() => setIsWaOpen(true)}
              >
                Kirim Notifikasi WA
              </Button>
            </div>
          </div>

          {/* Location & Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="font-bold text-slate-500 block mb-1">📍 Lokasi Kejadian:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{incident.lokasi}</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="font-bold text-slate-500 block mb-1">👥 Pihak Terlibat:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{incident.pihakTerlibat}</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Uraian Kronologis Kejadian:
            </span>
            <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed text-justify">
              {incident.uraian}
            </p>
          </div>

          {/* Initial Action & Follow Up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Tindakan Awal Petugas:
              </span>
              <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                {incident.tindakanAwal}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Tindak Lanjut / Rujukan:
              </span>
              <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                {incident.tindakLanjut || 'Belum ada rujukan lanjutan.'}
              </p>
            </div>
          </div>

          {/* Photo Gallery */}
          {incident.photos && incident.photos.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Dokumentasi Foto Bukti ({incident.photos.length}):
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {incident.photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.url)}
                    className="relative rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-800 cursor-pointer group shadow-xs hover:border-blue-500 transition-all"
                  >
                    <img
                      src={photo.url}
                      alt="Bukti Insiden"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Status Box */}
          {incident.status === 'SELESAI' ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Kasus Telah Selesai Ditangani ({incident.resolvedAt ? formatIndonesianDate(incident.resolvedAt) : 'Selesai'})</span>
              </div>
              <p className="text-emerald-700 dark:text-emerald-300">
                {incident.resolutionNote || 'Penanganan telah tuntas dan terkoordinasi dengan seluruh pihak terkait.'}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3">
              <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Update Status Penanganan Kasus Ini:
              </h5>
              <input
                type="text"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Catatan penanganan / solusi akhir..."
                className="w-full p-2.5 rounded-xl border border-amber-300 bg-white dark:bg-slate-900 text-xs focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={isSubmitting}
                  onClick={() => handleUpdateStatus('INVESTIGASI')}
                >
                  Set: Investigasi
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isSubmitting}
                  onClick={() => handleUpdateStatus('PENANGANAN')}
                >
                  Set: Penanganan
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  isLoading={isSubmitting}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => handleUpdateStatus('SELESAI')}
                >
                  Tandai Selesai (Kasus Ditutup)
                </Button>
              </div>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            <span>Pelapor: <strong>{incident.createdBy}</strong></span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onEdit(incident);
                }}
              >
                Edit Laporan
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Photo Fullscreen Zoom Modal */}
      <Modal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title="Dokumentasi Foto Bukti Kejadian"
        maxWidth="lg"
      >
        <div className="space-y-3">
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Foto Bukti Kejadian Zoom"
              className="w-full rounded-2xl object-cover max-h-[70vh] border border-slate-200 dark:border-slate-800 shadow-lg"
            />
          )}
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setSelectedPhoto(null)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={isWaOpen}
        onClose={() => setIsWaOpen(false)}
        title={`Kirim Notifikasi Kejadian: ${getIncidentCategoryDisplay(incident)}`}
        defaultMessage={waMessage}
      />
    </>
  );
};
