import React from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { VisitorRecord, getVisitorCategoryDisplay } from '../../types/visitor.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer } from '../../components/icons';
import './visitorPass.css';

interface VisitorPassPrintModalProps {
  isOpen: boolean; onClose: () => void; visitor: VisitorRecord | null; settings: SchoolSettings;
}
function VisitorPass({ visitor, settings }: { visitor: VisitorRecord; settings: SchoolSettings }) {
  const fields = [
    ['Nama tamu', visitor.namaTamu], ['Instansi asal', visitor.instansiAsal || '—'],
    ['Kategori tamu', getVisitorCategoryDisplay(visitor)], ['Waktu masuk', `${formatIndonesianDate(visitor.tanggal)} · ${visitor.jamMasuk} WIB`],
  ];
  return <article className="visitor-pass">
    <header className="visitor-pass-heading"><h3>{settings.schoolName}</h3><p>{settings.npsn ? `NPSN: ${settings.npsn} · ` : ''}Pos Keamanan & Ruang Piket</p><h4>SLIP IZIN MASUK TAMU</h4></header>
    <div className="visitor-pass-badge"><span>Nomor badge tamu</span><strong>{visitor.nomorBadge || '—'}</strong></div>
    <dl className="visitor-pass-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div className="visitor-pass-wide"><dt>Pihak yang dituju</dt><dd>{visitor.tujuanBertemu || '—'}</dd></div></dl>
    <section className="visitor-pass-purpose"><h4>Keperluan kunjungan</h4><p>{visitor.keperluan || '—'}</p></section>
    <div className="visitor-pass-signatures"><div><p>Petugas Piket / Satpam</p><strong>{visitor.petugasPiketName || '—'}</strong></div><div><p>Tanda tangan tamu</p><strong>{visitor.namaTamu}</strong></div></div>
    <p className="visitor-pass-note">Harap serahkan kembali slip ini ke pos keamanan saat meninggalkan area sekolah.</p>
  </article>;
}

/** Only this isolated portal is printed; the table and other dialogs stay off paper. */
export const VisitorPassPrintModal: React.FC<VisitorPassPrintModalProps> = ({ isOpen, onClose, visitor, settings }) => {
  if (!isOpen || !visitor) return null;
  return <>
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Slip Izin Tamu" maxWidth="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 text-sm"><p className="text-slate-600 dark:text-slate-300">Hanya slip tamu yang dicetak. Format A5, tegak.</p><Button type="button" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Cetak Slip Tamu</Button></div>
        <VisitorPass visitor={visitor} settings={settings} />
      </div>
    </Modal>
    {createPortal(<div id="visitor-pass-print-root" aria-hidden="true">
      <style>{`@media print {
        @page { size: A5 portrait; margin: 10mm; }
        html, body { height:auto !important; min-height:0 !important; overflow:visible !important; padding:0 !important; margin:0 !important; background:#fff !important; }
        body > :not(#visitor-pass-print-root) { display:none !important; }
        body > #visitor-pass-print-root { display:block !important; position:static !important; width:100% !important; color:#000 !important; }
      }`}</style>
      <VisitorPass visitor={visitor} settings={settings} />
    </div>, document.body)}
  </>;
};
