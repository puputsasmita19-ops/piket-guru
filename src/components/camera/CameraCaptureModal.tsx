import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Camera, RefreshCw, FlipHorizontal, Upload, AlertCircle, Check } from '../icons';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  allowFileUpload?: boolean;
  initialFacingMode?: 'user' | 'environment';
  title?: string;
  subtitle?: string;
  // Called before the shutter, so GPS can be refreshed before the photo is taken (for attendance)
  prepareCapture?: () => Promise<(canvas: HTMLCanvasElement, capturedAt: number) => string>;
  // Optional non-blocking GPS/font preparation during camera startup.
  warmupCapture?: () => void;
  // Unified watermark processor for documentation photos (incidents, tardy, visitors)
  watermarkProcessor?: (canvas: HTMLCanvasElement, capturedAt: number, isUpload: boolean) => Promise<string> | string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  allowFileUpload = true,
  initialFacingMode,
  title,
  subtitle,
  prepareCapture,
  warmupCapture,
  watermarkProcessor,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamModeRef = useRef<'user' | 'environment' | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async (mode: 'user' | 'environment') => {
    const generation = ++generationRef.current;
    setCameraError(null);
    setCameraReady(false);

    // Retake with the same lens: reuse the live stream instead of opening the camera again.
    if (streamModeRef.current === mode && streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) {
      streamRef.current.getVideoTracks().forEach((track) => { track.enabled = true; });
      const video = videoRef.current;
      if (video) {
        video.srcObject = streamRef.current;
        void video.play().catch(() => {
          if (generation === generationRef.current) setCameraError('Video belum dapat diputar. Ketuk Coba Kamera Lagi.');
        });
      }
      return;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    streamModeRef.current = null;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          // Selfie needs a legible watermark, not a high-resolution preview.
          // Capture at 640x480 to keep camera startup and image processing light on phones.
          width: { ideal: prepareCapture ? 640 : 800 },
          height: { ideal: prepareCapture ? 480 : 600 },
        },
        audio: false,
      });

      if (generation !== generationRef.current) {
        newStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = newStream;
      streamModeRef.current = mode;
      const video = videoRef.current;
      if (video) {
        video.srcObject = newStream;
        void video.play().catch(() => {
          if (generation === generationRef.current) setCameraError('Video belum dapat diputar. Ketuk Coba Kamera Lagi.');
        });
      }
    } catch (err: any) {
      if (generation !== generationRef.current) return;
      console.warn('Camera stream error:', err);
      setCameraError(
        allowFileUpload
          ? 'Kamera tidak dapat diakses. Anda dapat menggunakan tombol "Unggah Foto dari Perangkat" di bawah.'
          : 'Kamera tidak dapat diakses. Izinkan akses kamera pada peramban, lalu coba lagi.'
      );
    }
  };

  // When the photo preview is removed, React remounts the video element.
  // Reattach the existing live stream; do not request another permission/stream.
  useEffect(() => {
    if (!isOpen || capturedImage || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {});
  }, [capturedImage, isOpen]);

  useEffect(() => {
    setCaptureError(null);
    busyRef.current = false;
    setIsProcessing(false);
    if (isOpen) {
      setCapturedImage(null);
      // For attendance selfie, default to front camera ('user'). For documentation, default to environment.
      const initialMode = initialFacingMode || (prepareCapture ? 'user' : 'environment');
      setFacingMode(initialMode);
      // Start camera and capture prerequisites in parallel. Neither delays preview.
      warmupCapture?.();
      void startCamera(initialMode);
    }
    return () => {
      ++generationRef.current;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      streamModeRef.current = null;
    };
  }, [isOpen]);

  const handleTakeSnapshot = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsProcessing(true);
    setCaptureError(null);
    const generation = generationRef.current;

    try {
      const processor = await prepareCapture?.();
      if (generation !== generationRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !cameraReady || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        throw new Error('Kamera belum siap. Tunggu gambar kamera muncul lalu coba lagi.');
      }

      const capturedAt = Date.now();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Foto tidak dapat diproses. Coba gunakan browser lain.');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let dataUrl = '';
      if (processor) {
        dataUrl = processor(canvas, capturedAt);
      } else if (watermarkProcessor) {
        dataUrl = await watermarkProcessor(canvas, capturedAt, false);
      } else {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      // Suspend camera capture while reviewing the picture. Stream stays allocated
      // so retake is instant, and closing the dialog still stops all tracks.
      streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = false; });
      if (prepareCapture) {
        // Attendance: one shutter press creates a ready-to-submit draft.
        // No second photo confirmation and no automatic check-in.
        onCapture(dataUrl);
        onClose();
      } else {
        setCapturedImage(dataUrl);
      }
    } catch (error: any) {
      if (generation === generationRef.current) {
        setCaptureError(error?.message || 'Gagal memproses foto. Silakan ulangi.');
      }
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setIsProcessing(false);
      }
    }
  };

  const handleRetake = () => {
    setCaptureError(null);
    setCameraReady(false);
    streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = true; });
    setCapturedImage(null);
    // Stream is reattached by the effect when the video preview returns.
    if (!streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) {
      void startCamera(facingMode);
    }
  };

  const handleConfirm = () => {
    if (capturedImage && !busyRef.current) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!allowFileUpload || prepareCapture) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCameraError('Berkas yang dipilih harus berupa file gambar/foto.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        setIsProcessing(false);
        return;
      }

      const img = new Image();
      img.onload = async () => {
        try {
          const MAX_WIDTH = 960;
          const MAX_HEIGHT = 960;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);

            if (watermarkProcessor) {
              const watermarked = await watermarkProcessor(canvas, Date.now(), true);
              setCapturedImage(watermarked);
            } else {
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setCapturedImage(compressedDataUrl);
            }
          } else {
            setCapturedImage(rawDataUrl);
          }
        } catch (err: any) {
          setCaptureError(err?.message || 'Gagal memproses gambar yang dipilih.');
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setIsProcessing(false);
        setCameraError('Gagal membaca gambar yang dipilih.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const toggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const modalTitle = title || (prepareCapture ? 'Ambil Foto Selfie Presensi' : 'Ambil Foto Dokumentasi');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="md">
      <div className="space-y-4">
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        {captureError && (
          <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-800 dark:text-rose-200">
            {captureError}
          </div>
        )}
        {prepareCapture && (
          <p className="text-xs text-slate-500">
            Kamera dan GPS disiapkan bersamaan. Tekan Jepret Foto sekali; jika GPS sudah akurat, swafoto langsung diproses dan disimpan sebagai draf.
          </p>
        )}
        {watermarkProcessor && !prepareCapture && !subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Watermark resmi ditambahkan otomatis.
          </p>
        )}

        {cameraError && !capturedImage ? (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
            {allowFileUpload && !prepareCapture ? (
              <label className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] rounded-xl font-bold text-xs cursor-pointer hover:brightness-95 active:brightness-90 transition-colors shadow-sm">
                <Upload className="w-4 h-4" />
                <span>Pilih / Ambil Foto dari Perangkat</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            ) : (
              <Button size="sm" onClick={() => startCamera(facingMode)}>
                Coba Kamera Lagi
              </Button>
            )}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center shadow-inner border border-slate-800">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Pratinjau Foto Dokumentasi"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                onLoadedData={(event) => { if (event.currentTarget.srcObject === streamRef.current) setCameraReady(true); }}
                onPlaying={(event) => { if (event.currentTarget.srcObject === streamRef.current) setCameraReady(true); }}
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''}`}
              />
            )}

            {/* Processing Overlay during GPS & Compression */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center text-white space-y-3 z-10">
                <RefreshCw className="w-8 h-8 text-[var(--theme-primary)] animate-spin" />
                <div className="space-y-1">
                  <span className="font-bold text-sm block">Memeriksa GPS & Menyiapkan Swafoto...</span>
                  <span className="text-xs text-slate-300 block">
                    Menyinkronkan stempel informasi resmi dan kompresi file.
                  </span>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Controls Overlay when active */}
            {!capturedImage && !isProcessing && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors backdrop-blur-xs cursor-pointer"
                  title="Balik Arah Kamera"
                  aria-label="Balik Arah Kamera"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {capturedImage ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetake}
                disabled={isProcessing}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Ambil Ulang
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  leftIcon={<Check className="w-4 h-4" />}
                  className="w-full sm:w-auto font-bold shadow-md"
                >
                  Gunakan Foto Ini
                </Button>
              </div>
            </>
          ) : (
            <>
              {allowFileUpload && !prepareCapture ? (
                <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors w-full sm:w-auto">
                  <Upload className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                  <span>Unggah dari File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleTakeSnapshot}
                  disabled={isProcessing || !cameraReady || !!cameraError}
                  leftIcon={<Camera className="w-4 h-4" />}
                  className="w-full sm:w-auto font-bold shadow-md"
                >
                  {cameraReady ? 'Jepret Foto' : 'Menyiapkan Kamera…'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
