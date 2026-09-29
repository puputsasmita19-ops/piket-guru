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

  React.useEffect(() => {
    setPhone(defaultPhone);
    setMessage(defaultMessage);
  }, [defaultPhone, defaultMessage, isOpen]);

  const handleOpenWhatsApp = () => {
    if (!phone) {
      alert('Masukkan nomor WhatsApp tujuan terlebih dahulu.');
      return;
    }
    const link = WhatsAppService.generateWhatsAppLink(phone, message);
    window.open(link, '_blank');
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
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Nomor WhatsApp Tujuan (Format: 08... atau 628...)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="081234567890"
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
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
              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{isCopied ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>
          </div>
          <textarea
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-sans leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="success"
            size="sm"
            leftIcon={<ExternalLink className="w-4 h-4" />}
            onClick={handleOpenWhatsApp}
          >
            Buka WhatsApp Chat
          </Button>
        </div>
      </div>
    </Modal>
  );
};
