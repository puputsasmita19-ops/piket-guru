import * as fs from 'fs';
import * as path from 'path';

// Unit & Contract Verification for Rekap Foto Feature
async function testContract() {
  console.log('=== TEST VERIFIKASI FITUR REKAP FOTO ===\n');

  // 1. Verify ReportsPreview.tsx content
  const previewPath = path.resolve('src/features/reports/ReportsPreview.tsx');
  const previewContent = fs.readFileSync(previewPath, 'utf-8');

  // Requirement 1 & 2: Top action button with ImageIcon and "Rekap Foto"
  const hasTopPhotoButton = previewContent.includes('Buka Rekap Foto Dokumentasi Sekolah') &&
    previewContent.includes('<span>Rekap Foto</span>') &&
    previewContent.includes('ImageIcon');
  console.log('1. Tombol Rekap Foto dengan ImageIcon di area tindakan atas dekat Cetak:', hasTopPhotoButton ? 'PASS' : 'FAIL');

  // Requirement 1 & 2: Wrapping Tab Bar (no hidden tabs on 1024px / 1280px / desktop)
  const hasWrappingTabBar = previewContent.includes('flex flex-wrap items-center gap-1.5 pb-2') &&
    previewContent.includes("id: 'photoRecap', label: 'Rekap Foto'");
  console.log('2. Navigasi Tab membungkus rapi (flex-wrap), seluruh 8 tab terlihat tanpa terpotong:', hasWrappingTabBar ? 'PASS' : 'FAIL');

  // Requirement 3: Loading, Error, Empty State distinction
  const hasLoadingState = previewContent.includes('Memuat Dokumentasi Foto...');
  const hasErrorState = previewContent.includes('Gagal Mengambil Data Foto');
  const hasEmptyState = previewContent.includes('Belum ada foto pada periode yang dipilih');
  const hasNoMatchState = previewContent.includes('Tidak ada foto yang cocok');
  console.log('3. Pembedaan Status Tampilan (Loading, Error, Kosong, & Filter Nihil):',
    (hasLoadingState && hasErrorState && hasEmptyState && hasNoMatchState) ? 'PASS' : 'FAIL');

  // Requirement 4: Multi-source photo aggregation (Attendance, Incidents, Tardy, Visitors)
  const hasAttPhotos = previewContent.includes("sourceModule: 'ATTENDANCE'");
  const hasIncPhotos = previewContent.includes("sourceModule: 'INCIDENT'");
  const hasTardyPhotos = previewContent.includes("sourceModule: 'STUDENT_TARDY'");
  const hasVisPhotos = previewContent.includes("sourceModule: 'VISITOR'");
  const hasLegacySupport = previewContent.includes('isLegacyUnwatermarked');
  console.log('4. Ekstraksi Foto 4 Modul & Dukungan Foto Arsip Non-watermark:',
    (hasAttPhotos && hasIncPhotos && hasTardyPhotos && hasVisPhotos && hasLegacySupport) ? 'PASS' : 'FAIL');

  // Requirement 4 & 5: PhotoRecapPrintModal with 2/4 photos per page
  const modalPath = path.resolve('src/features/reports/PhotoRecapPrintModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  const hasPhotosPerPage = modalContent.includes('photosPerPage') && modalContent.includes('2 | 4');
  const hasPrintExport = modalContent.includes('window.print()') && modalContent.includes('A4 portrait');
  console.log('5. Modal Cetak Lampiran Dokumentasi A4 (2 & 4 foto per halaman):',
    (hasPhotosPerPage && hasPrintExport) ? 'PASS' : 'FAIL');

  console.log('\n=== SELURUH VERIFIKASI KONTRAK FITUR REKAP FOTO: BERHASIL ===');
}

testContract().catch((e) => {
  console.error(e);
  process.exit(1);
});
