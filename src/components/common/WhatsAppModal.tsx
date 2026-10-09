import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { MessageSquare, ExternalLink, Copy, Check } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  defaultPhone?: string;
  defaultMessage: string;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  title = 'Kirim Pesan WhatsApp',
  defaultPhone = '',
  defaultMessage,
}) => {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState(defaultMessage);
  const [isCopied, setIsCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    setPhone(defaultPhone);
    setMessage(defaultMessage);
    setValidationError(null);
  }, [defaultPhone, defaultMessage, isOpen]);

  const waLink = phone.trim() ? WhatsAppService.generateWhatsAppLink(phone.trim(), message) : '';

  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    if (!phone.trim()) {
      e.preventDefault();
      setValidationError('Silakan masukkan nomor WhatsApp tujuan (contoh: 081234567890).');
      return;
    }
    setValidationError(null);
    onClose();
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(message);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        {validationError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {validationError}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Nomor WhatsApp Tujuan (Format: 08... atau 628...)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="081234567890"
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs font-mono"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Isi Teks Pesan Template
            </label>
            <button
              type="button"
              onClick={handleCopyText}
              className="text-[11px] text-[var(--theme-primary)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{isCopied ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>
          </div>
          <textarea
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs font-sans leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka WhatsApp Chat</span>
            </a>
          ) : (
            <Button
              variant="success"
              size="sm"
              leftIcon={<ExternalLink className="w-4 h-4" />}
              onClick={handleOpenWhatsApp}
            >
              Buka WhatsApp Chat
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
