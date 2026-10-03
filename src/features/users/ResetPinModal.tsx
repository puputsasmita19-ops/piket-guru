import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { UserProfile } from '../../types';
import { KeyRound, ShieldAlert, Check, RefreshCw } from 'lucide-react';

interface ResetPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onReset: (userId: string, newPin: string) => Promise<void>;
}

export const ResetPinModal: React.FC<ResetPinModalProps> = ({
  isOpen,
  onClose,
  user,
  onReset,
}) => {
  const [newPin, setNewPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setErrorMsg('PIN Keamanan harus tepat 6 digit angka.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onReset(user.id, newPin);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mereset PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset PIN Keamanan Pengguna" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <span>Target Pengguna:</span>
          </div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{user.fullName}</p>
          <p className="text-slate-500 font-mono text-[11px]">NIP: {user.nip} • Role: {user.role}</p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Masukkan PIN Baru (Tepat 6 Digit Angka):
          </label>
          <input
            type="password"
            maxLength={6}
            required
            value={newPin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setNewPin(val);
            }}
            placeholder="••••••"
            className="w-full p-2.5 text-center tracking-widest text-lg font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-[11px] text-slate-400">Wajib 6 digit angka numerik unik tanpa pola berulang.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Simpan PIN Baru
          </Button>
        </div>
      </form>
    </Modal>
  );
};
