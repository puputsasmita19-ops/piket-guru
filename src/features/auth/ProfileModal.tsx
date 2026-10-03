import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ROLE_LABELS } from '../../config/constants';
import { KeyRound, ShieldCheck, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, changePin } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser) return null;

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setErrorMsg('PIN baru harus terdiri dari 6 digit angka.');
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMsg('Konfirmasi PIN baru tidak sesuai.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePin(oldPin, newPin);
      if (res.success) {
        if (res.refreshRevocation?.status === 'PENDING_RETRY') {
          setSuccessMsg('PIN Anda berhasil diubah dan penanda keamanan akun telah aktif. Pencabutan token sesi eksternal berstatus PENDING_RETRY.');
        } else {
          setSuccessMsg('PIN Anda berhasil diubah.');
        }
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setErrorMsg(res.error || 'Gagal mengubah PIN.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profil Pengguna & Keamanan PIN" maxWidth="lg">
      <div className="space-y-6">
        {/* User Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {currentUser.fullName.charAt(0)}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {currentUser.fullName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                NIP: {currentUser.nip}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentUser.email} • {currentUser.phone}
              </p>
            </div>
          </div>
          <Badge variant="primary" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            {ROLE_LABELS[currentUser.role]}
          </Badge>
        </div>

        {/* Change PIN Form */}
        <form onSubmit={handleChangePin} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Ganti 6-Digit PIN Akses</span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                PIN Lama
              </label>
              <input
                type="password"
                maxLength={6}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                placeholder="6 digit"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center font-mono text-sm tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                PIN Baru
              </label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="6 digit"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center font-mono text-sm tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Ulangi PIN Baru
              </label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="6 digit"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center font-mono text-sm tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Simpan PIN Baru
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
