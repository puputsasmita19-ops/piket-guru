import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Camera, RefreshCw, FlipHorizontal, Upload, AlertCircle, Check } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  allowFileUpload?: boolean;
  // Called before the shutter, so GPS can be refreshed before the photo is taken.
  prepareCapture?: () => Promise<(canvas: HTMLCanvasElement, capturedAt: number) => string>;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  allowFileUpload = true,
  prepareCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async (mode: 'user' | 'environment') => {
    const generation = ++generationRef.current;
    setCameraError(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (generation !== generationRef.current) {
        newStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      if (generation !== generationRef.current) return;
      console.warn('Camera stream error:', err);
      setCameraError(
        allowFileUpload
          ? 'Kamera tidak dapat diakses. Anda dapat menggunakan tombol "Unggah Foto" di bawah.'
          : 'Kamera tidak dapat diakses. Izinkan kamera pada browser, lalu coba lagi. Swafoto presensi harus diambil langsung dari kamera.'
      );
    }
  };

  useEffect(() => {
    setCaptureError(null);
    busyRef.current = false;
    setIsProcessing(false);
    if (isOpen) {
      setCapturedImage(null);
      startCamera(facingMode);
    }
    return () => {
      ++generationRef.current;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [isOpen, facingMode]);

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
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        throw new Error('Kamera belum siap. Tunggu gambar kamera muncul lalu coba lagi.');
      }
      const capturedAt = Date.now();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Foto tidak dapat diproses. Coba gunakan browser lain.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = processor ? processor(canvas, capturedAt) : canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
    } catch (error: any) {
      if (generation === generationRef.current) setCaptureError(error?.message || 'Gagal membuat foto. Silakan ulangi.');
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setIsProcessing(false);
      }
    }
  };

  const handleRetake = () => {
    setCaptureError(null);
    setCapturedImage(null);
    startCamera(facingMode);
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
      setCameraError('Berkas yang dipilih harus berupa gambar/foto.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          setCapturedImage(compressedDataUrl);
        } else {
          setCapturedImage(rawDataUrl);
        }
      };
      img.onerror = () => {
        setCameraError('Gagal memproses gambar yang dipilih.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ambil Foto Selfie Presensi" maxWidth="md">
      <div className="space-y-4">
        {captureError && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{captureError}</div>}
        {prepareCapture && <p className="text-xs text-slate-500">Foto akan diberi watermark nama, sekolah, waktu WIB, dan GPS. Tunggu proses GPS selesai sebelum foto diambil.</p>}
        {cameraError && !capturedImage ? (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
            {allowFileUpload && !prepareCapture ? <label className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] rounded-xl font-bold text-xs cursor-pointer hover:brightness-95 active:brightness-90 transition-colors shadow-sm">
              <Upload className="w-4 h-4" />
              <span>Pilih / Ambil Foto dari Perangkat</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label> : <Button size="sm" onClick={() => startCamera(facingMode)}>Coba Kamera Lagi</Button>}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center shadow-inner border border-slate-800">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Foto Selfie Presensi"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Switch Camera Overlay Button */}
            {!capturedImage && !cameraError && (
              <button
                type="button"
                onClick={toggleCamera}
                disabled={isProcessing}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-xs transition-colors cursor-pointer"
                title="Putar Kamera"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>

          {capturedImage ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleRetake}
              >
                Ulangi Foto
              </Button>
              <Button
                variant="success"
                size="sm"
                leftIcon={<Check className="w-4 h-4" />}
                onClick={handleConfirm}
              >
                Gunakan Foto Ini
              </Button>
            </div>
          ) : (
            !cameraError && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Camera className="w-4 h-4" />}
                onClick={handleTakeSnapshot}
                isLoading={isProcessing}
                loadingText="Menyiapkan GPS dan foto..."
              >
                Ambil Gambar
              </Button>
            )
          )}
        </div>
      </div>
    </Modal>
  );
};
