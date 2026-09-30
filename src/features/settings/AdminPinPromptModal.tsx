import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminPinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onSuccess: () => void;
}

export const AdminPinPromptModal: React.FC<AdminPinPromptModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    setTimeout(() => {
      // Validate PIN: check user's pin or default '123456'
      const validPin = currentUser?.pin || '123456';
      if (pin === validPin || pin === '123456') {
        setIsVerifying(false);
        setPin('');
        onClose();
        onSuccess();
      } else {
        setIsVerifying(false);
        setError('PIN Keamanan yang Anda masukkan salah. Akses ditolak.');
      }
    }, 400);
  };

  const handleClose = () => {
    setPin('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold">Verifikasi Otorisasi Wewenang:</span> {description}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-blue-500" />
            Masukkan PIN Keamanan Akun Anda:
          </label>
          <input
            type="password"
            maxLength={6}
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center font-mono text-xl tracking-[0.4em] font-bold"
          />
          <p className="text-[10px] text-slate-400 text-center">
            Gunakan PIN 6 digit akun Anda (Default: 123456)
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            isLoading={isVerifying}
            leftIcon={<KeyRound className="w-4 h-4" />}
          >
            Verifikasi & Lanjutkan
          </Button>
        </div>
      </form>
    </Modal>
  );
};
