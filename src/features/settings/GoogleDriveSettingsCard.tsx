import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Power,
  HelpCircle,
  Key,
  Database,
  Cloud,
  XCircle,
  FileText,
  Info,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { DriveClientService, DriveStatusResponse } from '../../services/drive/driveClientService';
import { beginSessionActivity } from '../../services/auth/backgroundSession';

export const GoogleDriveSettingsCard: React.FC = () => {
  const [status, setStatus] = useState<DriveStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [toggling, setToggling] = useState<boolean>(false);
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await DriveClientService.getStatus();
      setStatus(data);

      // Read query params from callback redirect if present
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const driveStatus = urlParams.get('drive_status');
        const driveMessage = urlParams.get('drive_message');
        const driveEmail = urlParams.get('drive_email');

        if (driveStatus === 'success') {
          setFeedback({
            tone: 'success',
            message: `Berhasil menghubungkan Google Drive (${driveEmail || 'Pemilik'}). Lakukan 'Uji Koneksi' sebelum mengaktifkan penyimpanan foto baru.`,
          });
          // Clean URL params
          window.history.replaceState({}, document.title, window.location.pathname + '#settings');
        } else if (driveStatus === 'error') {
          setFeedback({
            tone: 'error',
            message: driveMessage || 'Gagal menghubungkan Google Drive.',
          });
          window.history.replaceState({}, document.title, window.location.pathname + '#settings');
        }
      }
    } catch (err: any) {
      console.warn('[DRIVE_CARD] Error fetching status:', err);
      setFeedback({
        tone: 'error',
        message: err.message || 'Gagal memuat status Google Drive backend.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    setFeedback(null);
    try {
      const authData = await DriveClientService.getAuthUrl();
      // Redirect to Google OAuth Consent screen
      beginSessionActivity(300_000);
      window.location.href = authData.url;
    } catch (err: any) {
      setFeedback({
        tone: 'error',
        message: err.message || 'Gagal menyiapkan pautan otorisasi Google OAuth.',
      });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await DriveClientService.testConnection();
      if (result.success) {
        setFeedback({
          tone: 'success',
          message: result.message,
        });
      } else {
        setFeedback({
          tone: 'error',
          message: result.message,
        });
      }
      await fetchStatus();
    } catch (err: any) {
      setFeedback({
        tone: 'error',
        message: err.message || 'Uji koneksi gagal.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (targetEnabled: boolean) => {
    setToggling(true);
    setFeedback(null);
    try {
      const res = await DriveClientService.toggleStorage(targetEnabled);
      setFeedback({
        tone: 'success',
        message: res.message,
      });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({
        tone: 'error',
        message: err.message || 'Gagal mengubah status pengaktifan.',
      });
    } finally {
      setToggling(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Apakah Anda yakin ingin memutuskan koneksi Google Drive?\n\nFoto lama yang sudah tersimpan di Drive tetap aman dan dapat diakses, namun foto baru tidak akan diunggah ke Drive ini.')) {
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      await DriveClientService.disconnect();
      setFeedback({
        tone: 'info',
        message: 'Koneksi Google Drive telah diputuskan.',
      });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({
        tone: 'error',
        message: err.message || 'Gagal memutuskan koneksi.',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = () => {
    if (!status) return null;

    if (status.status === 'CONNECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Terhubung ({status.accountEmail})
        </span>
      );
    }

    if (status.status === 'NEEDS_RECONNECT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          Perlu Dihubungkan Ulang
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
        <XCircle className="w-3.5 h-3.5" />
        Belum Terhubung
      </span>
    );
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader
        title="Penyimpanan Foto Google Drive Pribadi"
        subtitle="Simpan foto presensi, kejadian, keterlambatan, dan buku tamu ke Google Drive pribadi pemilik (~5 TB) tanpa membebankan kuota Firestore."
        action={renderStatusBadge()}
        className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 py-4 px-6"
      />

      <CardContent className="p-6 space-y-6">
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              feedback.tone === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                : feedback.tone === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800'
            }`}
          >
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : feedback.tone === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{feedback.message}</div>
          </div>
        )}

        {/* Environment status banner */}
        {status && !status.configuredInEnv && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Variabel Lingkungan Server Belum Dilengkapi:</span>
              <p>
                Server membutuhkan variabel <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">GOOGLE_CLIENT_ID</code> dan <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">GOOGLE_CLIENT_SECRET</code> di Vercel / Environment backend.
              </p>
              <button
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="text-blue-600 dark:text-blue-400 font-semibold underline hover:text-blue-700 inline-flex items-center gap-1 mt-1"
              >
                Lihat Panduan Setup Google OAuth Client <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Detail connection box */}
        {status && status.status === 'CONNECTED' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">Akun Terhubung:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-500" />
                {status.accountEmail}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">Folder Utama di My Drive:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-500" />
                {status.rootFolderName} (Tahun/Bulan/Modul)
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">Status Pengaktifan Modul:</span>
              <span className="font-bold">
                {status.enabled ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Power className="w-3.5 h-3.5" /> Aktif (Foto baru disimpan ke Drive)
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Power className="w-3.5 h-3.5" /> Nonaktif (Perlu diaktifkan setelah uji)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            {status?.status === 'CONNECTED' ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTest}
                  disabled={testing || loading}
                  className="flex items-center gap-2 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  {testing ? 'Menguji Koneksi...' : 'Uji Koneksi'}
                </Button>

                {status.enabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleToggle(false)}
                    disabled={toggling || loading}
                    className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 border-amber-300"
                  >
                    <Power className="w-3.5 h-3.5" />
                    Nonaktifkan Penyimpanan Drive
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleToggle(true)}
                    disabled={toggling || loading}
                    className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Power className="w-3.5 h-3.5" />
                    Aktifkan Penyimpanan Drive untuk Foto Baru
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleConnect}
                  disabled={loading}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Hubungkan Ulang / Ganti Akun
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleConnect}
                disabled={loading || !status?.configuredInEnv}
                className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Cloud className="w-4 h-4" />
                Hubungkan Google Drive Pribadi
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showSetupGuide ? 'Sembunyikan Panduan Setup' : 'Panduan Setup Google Console'}
            </button>

            {status?.status === 'CONNECTED' && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
              >
                Putuskan Koneksi
              </button>
            )}
          </div>
        </div>

        {/* Manual Setup Guide Section */}
        {showSetupGuide && (
          <div className="mt-4 p-5 bg-slate-900 text-slate-100 rounded-2xl text-xs space-y-4 font-sans leading-relaxed border border-slate-700 shadow-inner">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-400 border-b border-slate-800 pb-2">
              <Key className="w-4 h-4" />
              Panduan Langkah demi Langkah Konfigurasi Google Drive OAuth 2.0
            </div>

            <ol className="list-decimal pl-5 space-y-3 text-slate-300">
              <li>
                <strong className="text-white">Aktifkan Google Drive API:</strong>
                <p className="mt-0.5 text-slate-400">
                  Buka Google Cloud Console &gt; Pilih/buat project Google Cloud &gt; Masuk ke <em>APIs & Services &gt; Library</em> &gt; Cari <strong>Google Drive API</strong> &gt; Klik <strong>Enable</strong>.
                </p>
              </li>

              <li>
                <strong className="text-white">Atur OAuth Consent Screen:</strong>
                <p className="mt-0.5 text-slate-400">
                  Masuk ke <em>APIs & Services &gt; OAuth consent screen</em>. Pilih User Type <strong>External</strong> &gt; Isi App Name (misal: <code>Piket Guru Storage</code>), User Support Email, dan Developer Contact.
                </p>
                <p className="mt-1 text-amber-300 bg-amber-950/60 p-2 rounded border border-amber-800/60 text-[11px]">
                  <strong>Catatan Produksi Refresh Token:</strong> Dalam mode status <em>In Testing</em>, refresh token Google OAuth akan kadaluwarsa dalam 7 hari. Untuk penggunaan jangka panjang tanpa perlu re-authentikasi tiap minggu, tambahkan email pemilik ke daftar <em>Test Users</em> atau klik <strong>Publish App</strong> ke status Production.
                </p>
              </li>

              <li>
                <strong className="text-white">Buat OAuth 2.0 Client ID:</strong>
                <p className="mt-0.5 text-slate-400">
                  Masuk ke <em>APIs & Services &gt; Credentials</em> &gt; Klik <strong>Create Credentials</strong> &gt; Pilih <strong>OAuth client ID</strong>.
                </p>
                <p className="mt-0.5 text-slate-400">
                  Pilih Application type: <strong>Web application</strong>.
                </p>
              </li>

              <li>
                <strong className="text-white">Daftarkan Authorized Redirect URIs:</strong>
                <p className="mt-0.5 text-slate-400">
                  Tambahkan URI callback persis berikut sesuai domain aplikasi Vercel Anda:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 break-all select-all mt-1">
                  https://[DOMAIN-VERCEL-ANDA]/api/drive/auth/callback
                </div>
                <p className="mt-1 text-slate-400 text-[11px]">
                  Untuk pengujian lokal dev, tambahkan juga: <code>http://localhost:3000/api/drive/auth/callback</code>
                </p>
              </li>

              <li>
                <strong className="text-white">Pengisian Environment Variables di Vercel / Server:</strong>
                <p className="mt-0.5 text-slate-400">
                  Salin Client ID dan Client Secret yang diperoleh, kemudian tambahkan ke Environment Variables di Vercel:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-blue-300 space-y-1 mt-1">
                  <div>GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com</div>
                  <div>GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx</div>
                  <div>GOOGLE_REDIRECT_URI=https://[DOMAIN-VERCEL-ANDA]/api/drive/auth/callback</div>
                  <div>DRIVE_ENCRYPTION_SECRET=kunci_rahasia_enkripsi_bebas_32_karakter</div>
                </div>
              </li>

              <li>
                <strong className="text-white">Penyelesaian Integrasi:</strong>
                <p className="mt-0.5 text-slate-400">
                  Setelah Environment Variables diisi di Vercel & Redeployed, klik tombol <strong>"Hubungkan Google Drive Pribadi"</strong> di atas. Selesaikan persetujuan Google OAuth. Lakukan <strong>"Uji Koneksi"</strong>, lalu aktifkan sakelar penyimpanan Drive!
                </p>
              </li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
