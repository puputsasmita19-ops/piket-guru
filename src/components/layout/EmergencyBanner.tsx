import React, { useState, useEffect } from 'react';
import { AlertOctagon, Volume2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { EmergencyService } from '../../services/notifications/emergencyService';
import { EmergencyAlert } from '../../types/security.types';
import { useAuth } from '../../contexts/AuthContext';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Button } from '../common/Button';
import { SchoolBellService } from '../../services/audio/bellService';

export const EmergencyBanner: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    const unsub = EmergencyService.subscribeToActiveEmergency((alert) => {
      setActiveEmergency(alert);
      if (alert && alert.soundAlert) {
        // Play once when alert becomes active
        if (alert.type === 'EARTHQUAKE') {
          SchoolBellService.playEarthquakeAlarm();
        } else if (alert.type === 'FIRE') {
          SchoolBellService.playFireAlarm();
        } else {
          SchoolBellService.playEmergencyAlarm();
        }
      }
    });

    return () => unsub();
  }, []);

  if (!activeEmergency) return null;

  const handleSoundReplay = () => {
    if (activeEmergency.type === 'EARTHQUAKE') {
      SchoolBellService.playEarthquakeAlarm();
    } else if (activeEmergency.type === 'FIRE') {
      SchoolBellService.playFireAlarm();
    } else {
      SchoolBellService.playEmergencyAlarm();
    }
  };

  const handleResolve = async () => {
    if (!currentUser || !isAdmin) return;
    setIsResolving(true);
    try {
      await EmergencyService.resolveEmergency(
        currentUser,
        'Situasi siaga telah ditangani secara tuntas dan kondisi sekolah dinyatakan aman.'
      );
    } finally {
      setIsResolving(false);
    }
  };

  const getTheme = () => {
    switch (activeEmergency.type) {
      case 'EARTHQUAKE':
        return {
          bg: 'bg-rose-600 text-white',
          border: 'border-rose-700',
          label: '🚨 SIAGA GEMPA BUMI / EVAKUASI LAPANGAN',
        };
      case 'FIRE':
        return {
          bg: 'bg-orange-600 text-white',
          border: 'border-orange-700',
          label: '🔥 PERINGATAN BAHAYA KEBAKARAN / TITIK KUMPUL',
        };
      case 'SECURITY':
        return {
          bg: 'bg-amber-600 text-white',
          border: 'border-amber-700',
          label: '⚠️ SIAGA KEAMANAN / LOCKDOWN KELAS',
        };
      default:
        return {
          bg: 'bg-red-700 text-white',
          border: 'border-red-800',
          label: '📢 PENGUMUMAN DARURAT SEKOLAH',
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      className={`sticky top-0 z-50 ${theme.bg} border-b ${theme.border} px-4 py-3 shadow-xl animate-pulse transition-all`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm animate-bounce">
            <AlertOctagon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold uppercase tracking-wider text-sm flex items-center gap-2">
              <span>{theme.label}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30">
                {activeEmergency.type}
              </span>
            </div>
            <p className="font-medium text-white/95 text-xs sm:text-sm mt-0.5">
              {activeEmergency.title}: {activeEmergency.message}
            </p>
            <div className="text-[10px] text-white/80 mt-1 flex items-center gap-3 font-mono">
              <span>Waktu: {formatIndonesianDate(activeEmergency.triggeredAt)}</span>
              <span>• Pelapor: {activeEmergency.triggeredByName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSoundReplay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition cursor-pointer backdrop-blur-sm"
            title="Putar Ulang Sirine Audio"
          >
            <Volume2 className="w-4 h-4" />
            <span>Putar Sirine</span>
          </button>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isResolving}
              onClick={handleResolve}
              className="bg-white text-rose-700 hover:bg-rose-50 border-white font-extrabold text-xs shadow-md"
              leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            >
              Matikan Alarm & Nyatakan Aman
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
