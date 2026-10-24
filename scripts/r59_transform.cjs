'use strict';
const fs = require('node:fs');

const header = 'R59_PHOTO_OPTIMIZED';
function replaceExactly(source, oldPart, newPart, label) {
  const a = source.indexOf(oldPart);
  if (a < 0 || source.indexOf(oldPart, a + oldPart.length) >= 0) throw new Error(`R59 STOPPED SAFELY: pola ${label} tidak cocok atau tidak unik. Jangan menimpa source terbaru.`);
  return source.slice(0, a) + newPart + source.slice(a + oldPart.length);
}
function transformImage(source) {
  if (source.includes(header)) throw new Error('R59 STOPPED SAFELY: perubahan foto sudah diterapkan.');
  let s = replaceExactly(source,
    "  const statusCallback = useRef(onStatusChange);\n  statusCallback.current = onStatusChange;",
    `  // ${header}: delay private Drive fetch until the preview nears the viewport.\n  const viewportRef = useRef<HTMLDivElement | null>(null);\n  const [visibleDriveSrc, setVisibleDriveSrc] = useState<string>('');\n  const isDrivePhoto = Boolean(src?.startsWith('/api/drive/photo/'));\n  const isVisible = !isDrivePhoto || visibleDriveSrc === src;\n  const statusCallback = useRef(onStatusChange);\n  statusCallback.current = onStatusChange;\n\n  useEffect(() => {\n    if (!isDrivePhoto || isVisible) return;\n    const target = viewportRef.current;\n    if (!target || typeof IntersectionObserver === 'undefined') { setVisibleDriveSrc(src!); return; }\n    const observer = new IntersectionObserver((entries) => {\n      if (entries.some(entry => entry.isIntersecting)) { setVisibleDriveSrc(src!); observer.disconnect(); }\n    }, { rootMargin: '250px 0px' });\n    observer.observe(target);\n    return () => observer.disconnect();\n  }, [src, isDrivePhoto, isVisible]);`,
    'image observer');
  s = replaceExactly(s,
    "    if (!src) {\n      setResolvedSrc('');\n      return;\n    }",
    "    if (!src || !isVisible) {\n      setResolvedSrc('');\n      return;\n    }",
    'image fetch gating');
  s = replaceExactly(s, "  }, [src]);", "  }, [src, isVisible]);", 'image effect dependencies');
  s = replaceExactly(s,
    "  if (hasError || !src || !resolvedSrc) {",
    "  if (hasError || !src || !isVisible || !resolvedSrc) {",
    'image fallback conditions');
  s = replaceExactly(s,
    '      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 ${className || \'\'}`}>',
    '      <div ref={viewportRef} className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 ${className || \'\'}`}>',
    'image viewport marker');
  s = replaceExactly(s,
    '    <img\n      src={resolvedSrc}',
    '    <img\n      loading={props.loading || \'lazy\'}\n      decoding={props.decoding || \'async\'}\n      src={resolvedSrc}',
    'image decode hint');
  return s;
}
function transformDriveRoutes(source) {
  if (source.includes(header)) throw new Error('R59 STOPPED SAFELY: pembaruan Drive sudah diterapkan.');
  let s = replaceExactly(source,
    "import { adminAuth, adminDb } from '../firebaseAdmin.js';",
    "import { adminAuth, adminDb } from '../firebaseAdmin.js';\nimport { decodeDrivePhotoUpload, PhotoUploadValidationError } from '../services/photoUploadValidation.js'; // R59_PHOTO_OPTIMIZED",
    'drive validator import');
  s = replaceExactly(s,
    "  console.info('[DRIVE_UPLOAD] started', { module });",
    `  if (clientPhotoId !== undefined && (typeof clientPhotoId !== 'string' || !/^[A-Za-z0-9_-]{5,96}$/.test(clientPhotoId))) {\n    res.status(400).json({ success: false, error: 'ID foto tidak valid.' }); return;\n  }\n  if (recordId !== undefined && (typeof recordId !== 'string' || recordId.length > 160)) {\n    res.status(400).json({ success: false, error: 'ID catatan tidak valid.' }); return;\n  }\n\n  console.info('[DRIVE_UPLOAD] started', { module });`,
    'drive idempotency validation');
  const start = s.indexOf('    // Strip Base64 header prefix if present');
  const end = s.indexOf('    const uploadResult = await DriveStore.uploadPhoto({', start);
  if (start < 0 || end < 0 || s.indexOf('    // Strip Base64 header prefix if present', start + 1) >= 0) throw new Error('R59 STOPPED SAFELY: blok unggah Drive tidak cocok.');
  s = s.slice(0, start) + `    const { buffer, mimeType: safeMimeType } = decodeDrivePhotoUpload(base64, mimeType);\n\n` + s.slice(end);
  s = replaceExactly(s,
    "      mimeType: mimeType || 'image/jpeg',",
    "      mimeType: safeMimeType,",
    'drive safe MIME');
  // Handle malformed uploads as user errors without calling Drive API.
  s = replaceExactly(s,
    "  } catch (err: any) {\n    console.error('[DRIVE_UPLOAD] failed',",
    "  } catch (err: any) {\n    if (err instanceof PhotoUploadValidationError) { res.status(400).json({ success: false, error: err.message }); return; }\n    console.error('[DRIVE_UPLOAD] failed',",
    'drive bad request');
  s = replaceExactly(s,
    '    photoData.stream.pipe(res);',
    `    photoData.stream.on('error', () => { if (!res.headersSent) res.status(502).end(); else res.destroy(); });\n    res.on('close', () => { if (!res.writableEnded) photoData.stream.destroy(); });\n    photoData.stream.pipe(res);`,
    'drive aborted proxy');
  return s;
}
function transformDriveStore(source) {
  if (source.includes(header)) throw new Error('R59 STOPPED SAFELY: ekstensi file Drive sudah dioptimalkan.');
  return replaceExactly(source,
    '    const fileName = `PG_${options.module.toUpperCase()}_${fileTimestamp}_${randomHex}.jpg`;',
    `    // ${header}: keep file extensions in sync with validated MIME.
    const fileExtension = options.mimeType === 'image/png' ? 'png' : options.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const fileName = \`PG_\${options.module.toUpperCase()}_\${fileTimestamp}_\${randomHex}.\${fileExtension}\`;`,
    'drive file extension');
}
module.exports = { transformImage, transformDriveRoutes, transformDriveStore };
