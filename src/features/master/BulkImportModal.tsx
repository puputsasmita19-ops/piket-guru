import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  GraduationCap,
  X,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { authService, UserSummaryItem } from '../../services/auth/authService';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, UserRole } from '../../types';
import { TeacherRecord, StudentRecord, StaffRecord } from '../../types/master.types';

export type ImportType = 'USERS_TEACHERS' | 'STUDENTS';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: ImportType;
  onSuccess?: () => void;
}

interface ParsedUserRow {
  loginId: string;
  isGeneratedLoginId?: boolean;
  nip: string;
  nuptk?: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  mataPelajaran: string;
  pangkatGolongan: string;
  statusKepegawaian: string;
  pin: string;
  isValid: boolean;
  error?: string;
}

interface ParsedStudentRow {
  studentId: string;
  isGeneratedStudentId?: boolean;
  nis: string;
  nisn: string;
  nama: string;
  kelas: string;
  jenisKelamin: 'L' | 'P';
  noHpSiswa?: string;
  noHpOrangTua: string;
  alamat: string;
  isValid: boolean;
  error?: string;
  warning?: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'USERS_TEACHERS',
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [importType, setImportType] = useState<ImportType>(defaultType);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedUsers, setParsedUsers] = useState<ParsedUserRow[]>([]);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudentRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // Existing database identifiers to detect collisions reliably
  const [existingLoginIds, setExistingLoginIds] = useState<Set<string>>(new Set());
  const [existingNips, setExistingNips] = useState<Set<string>>(new Set());
  const [existingStudentNis, setExistingStudentNis] = useState<Set<string>>(new Set());
  const [existingStudentNisn, setExistingStudentNisn] = useState<Set<string>>(new Set());
  const [existingStudentIds, setExistingStudentIds] = useState<Set<string>>(new Set());

  // Load existing records from database when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadExisting = async () => {
      try {
        const [usersSummary, teachers, staff, students] = await Promise.all([
          authService.getUsersList().catch(() => [] as UserSummaryItem[]),
          FirestoreService.getAllRaw<TeacherRecord>('teachers').catch(() => [] as TeacherRecord[]),
          FirestoreService.getAllRaw<StaffRecord>('staff').catch(() => [] as StaffRecord[]),
          FirestoreService.getAllRaw<StudentRecord>('students').catch(() => [] as StudentRecord[]),
        ]);

        if (!isMounted) return;

        const loginSet = new Set<string>();
        const nipSet = new Set<string>();
        const studentNisSet = new Set<string>();
        const studentNisnSet = new Set<string>();
        const studentIdSet = new Set<string>();

        usersSummary.forEach((u) => {
          if (u.loginId) loginSet.add(u.loginId.trim().toUpperCase());
          if (u.nip && u.nip.trim() !== '' && u.nip !== '-') nipSet.add(u.nip.trim());
        });

        teachers.forEach((t) => {
          if (t.idGuru) loginSet.add(t.idGuru.trim().toUpperCase());
          if (t.id) loginSet.add(t.id.trim().toUpperCase());
          if (t.nip && t.nip.trim() !== '' && t.nip !== '-') nipSet.add(t.nip.trim());
        });

        staff.forEach((s) => {
          if (s.id) loginSet.add(s.id.trim().toUpperCase());
          if (s.nip && s.nip.trim() !== '' && s.nip !== '-') nipSet.add(s.nip.trim());
        });

        students.forEach((std) => {
          if (std.id) studentIdSet.add(std.id.trim());
          if (std.studentId) studentIdSet.add(std.studentId.trim());
          if (std.nis && std.nis.trim() !== '' && std.nis !== '-') {
            studentNisSet.add(std.nis.trim());
          }
          if (std.nisn && std.nisn.trim() !== '' && std.nisn !== '-') {
            studentNisnSet.add(std.nisn.trim());
          }
        });

        setExistingLoginIds(loginSet);
        setExistingNips(nipSet);
        setExistingStudentNis(studentNisSet);
        setExistingStudentNisn(studentNisnSet);
        setExistingStudentIds(studentIdSet);
      } catch (err) {
        console.warn('Could not load existing master data for import collision check:', err);
      }
    };

    loadExisting();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Reset when opening / switching type
  useEffect(() => {
    setImportType(defaultType);
    setRawText('');
    setFileName('');
    setParsedUsers([]);
    setParsedStudents([]);
    setImportProgress(null);
    setImportResult(null);
  }, [isOpen, defaultType]);

  const handleDownloadTemplate = () => {
    if (importType === 'USERS_TEACHERS') {
      const csvHeader = 'ID Login,NIP,Nama Lengkap,Role,Email,No HP,Mata Pelajaran,Pangkat Golongan,Status Kepegawaian,PIN Awal\n';
      const csvRows = [
        'GURU-001,198503152010011002,Dra. Siti Aminah M.Pd,GURU,siti.aminah@sekolah.sch.id,081234567891,Bahasa Indonesia,Pembina / IVa,PNS,123456',
        'GURU-002,,Budi Santoso S.Pd,GURU,budi.santoso@sekolah.sch.id,081234567892,Matematika,Penata Muda / IIIa,PPPK,123456',
        'GURU-003,,Nur Halimah S.Pd,GURU,nur.halimah@sekolah.sch.id,081234567893,Bahasa Inggris,-,Honorer,123456',
        'STAFF-001,199512142022041005,Ahmad Fauzi S.Kom,TENAGA_KEPENDIDIKAN,ahmad.fauzi@sekolah.sch.id,081234567894,-,-,Honorer,123456',
        'SATPAM-001,,Rian Kurniawan,SATPAM,rian.kurniawan@sekolah.sch.id,081234567895,-,-,PTT,123456',
      ].join('\n');
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Import_Guru_Pengguna_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csvHeader = 'NIS,NISN,Nama Lengkap,Kelas,Jenis Kelamin,No HP Siswa (Opsional),No HP Orang Tua,Alamat\n';
      const csvRows = [
        '1481/080.531,0081234561,Ahmad Pratama,X MIPA 1,L,081298765401,081234567890,Jl. Merdeka No. 10',
        '1482/080.532,,Dewi Anggraini,X MIPA 1,P,,081234567891,Jl. Melati No. 4',
        ',0081234563,Fajar Nugroho,X IPS 2,L,081298765403,081234567892,Jl. Anggrek No. 12',
        ',,Siti Nurhaliza,XI MIPA 2,P,,081234567893,Jl. Kenanga No. 8',
      ].join('\n');
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Import_Siswa_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const splitLine = (line: string): string[] => {
    // Support comma or semicolon delimiter
    const delimiter = line.includes(';') ? ';' : ',';
    const values: string[] = [];
    let current = '';
    let insideQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === delimiter && !insideQuote) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return values;
  };

  const parseCsvText = useCallback(
    (
      text: string,
      type: ImportType,
      currentLogins = existingLoginIds,
      currentNips = existingNips
    ) => {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setParsedUsers([]);
        setParsedStudents([]);
        return;
      }

      // Check if first line is a header
      const firstLineCols = splitLine(lines[0]).map((h) => h.toLowerCase().trim());
      const isFirstLineHeader = firstLineCols.some(
        (h) =>
          h.includes('nip') ||
          h.includes('nisn') ||
          h.includes('nama') ||
          h.includes('kelas') ||
          h.includes('login') ||
          h.includes('role') ||
          h.includes('peran')
      );

      const dataLines = isFirstLineHeader ? lines.slice(1) : lines;

      if (type === 'USERS_TEACHERS') {
        const findIdx = (keywords: string[]) =>
          firstLineCols.findIndex((h) => keywords.some((k) => h.includes(k)));

        const colIdxLogin = findIdx(['id login', 'login id', 'kode pegawai', 'id_login', 'login']);
        const colIdxNip = findIdx(['nip']);
        const colIdxNuptk = findIdx(['nuptk']);
        const colIdxNama = findIdx(['nama', 'nama lengkap']);
        const colIdxRole = findIdx(['role', 'peran', 'jabatan']);
        const colIdxEmail = findIdx(['email', 'surel']);
        const colIdxPhone = findIdx(['no hp', 'nomor hp', 'telepon', 'phone', 'wa', 'kontak', 'hp']);
        const colIdxMapel = findIdx(['mata pelajaran', 'mapel']);
        const colIdxPangkat = findIdx(['pangkat', 'golongan', 'pangkat golongan']);
        const colIdxStatus = findIdx(['status kepegawaian', 'status', 'kepegawaian']);
        const colIdxPin = findIdx(['pin', 'pin awal', 'password', 'sandi']);

        // First pass: extract raw column data
        interface RawRowItem {
          rawLoginId: string;
          nip: string;
          nuptk: string;
          fullName: string;
          role: UserRole;
          roleRaw: string;
          roleValid: boolean;
          email: string;
          phone: string;
          mataPelajaran: string;
          pangkatGolongan: string;
          statusKepegawaian: string;
          pin: string;
        }

        const rawItems: RawRowItem[] = dataLines.map((line) => {
          const cols = splitLine(line);

          let rawLoginId = '';
          let nip = '';
          let nuptk = '';
          let fullName = '';
          let roleRaw = 'GURU';
          let email = '';
          let phone = '';
          let mataPelajaran = 'Umum';
          let pangkatGolongan = '-';
          let statusKepegawaian = 'PNS';
          let pin = '123456';

          if (isFirstLineHeader && colIdxLogin !== -1) {
            // Modern header format with explicit ID Login column
            rawLoginId = (cols[colIdxLogin] || '').trim();
            nip = colIdxNip !== -1 ? (cols[colIdxNip] || '').trim() : '';
            nuptk = colIdxNuptk !== -1 ? (cols[colIdxNuptk] || '').trim() : '';
            fullName = colIdxNama !== -1 ? (cols[colIdxNama] || '').trim() : '';
            roleRaw = colIdxRole !== -1 ? (cols[colIdxRole] || 'GURU').trim() : 'GURU';
            email = colIdxEmail !== -1 ? (cols[colIdxEmail] || '').trim() : '';
            phone = colIdxPhone !== -1 ? (cols[colIdxPhone] || '').trim() : '';
            mataPelajaran = colIdxMapel !== -1 ? (cols[colIdxMapel] || 'Umum').trim() : 'Umum';
            pangkatGolongan = colIdxPangkat !== -1 ? (cols[colIdxPangkat] || '-').trim() : '-';
            statusKepegawaian = colIdxStatus !== -1 ? (cols[colIdxStatus] || 'PNS').trim() : 'PNS';
            pin = colIdxPin !== -1 ? (cols[colIdxPin] || '123456').trim() : '123456';
          } else if (isFirstLineHeader && colIdxLogin === -1) {
            // Legacy header format without ID Login (starts with NIP)
            rawLoginId = '';
            nip = colIdxNip !== -1 ? (cols[colIdxNip] || '').trim() : (cols[0] || '').trim();
            nuptk = colIdxNuptk !== -1 ? (cols[colIdxNuptk] || '').trim() : '';
            fullName = colIdxNama !== -1 ? (cols[colIdxNama] || '').trim() : (cols[1] || '').trim();
            roleRaw = colIdxRole !== -1 ? (cols[colIdxRole] || 'GURU').trim() : (cols[2] || 'GURU').trim();
            email = colIdxEmail !== -1 ? (cols[colIdxEmail] || '').trim() : (cols[3] || '').trim();
            phone = colIdxPhone !== -1 ? (cols[colIdxPhone] || '').trim() : (cols[4] || '').trim();
            mataPelajaran = colIdxMapel !== -1 ? (cols[colIdxMapel] || 'Umum').trim() : (cols[5] || 'Umum').trim();
            pangkatGolongan = colIdxPangkat !== -1 ? (cols[colIdxPangkat] || '-').trim() : (cols[6] || '-').trim();
            statusKepegawaian = colIdxStatus !== -1 ? (cols[colIdxStatus] || 'PNS').trim() : (cols[7] || 'PNS').trim();
            pin = colIdxPin !== -1 ? (cols[colIdxPin] || '123456').trim() : (cols[8] || '123456').trim();
          } else if (cols.length >= 10) {
            // 10 positional columns: ID Login, NIP, Nama, Role, Email, No HP, Mapel, Pangkat, Status, PIN
            rawLoginId = (cols[0] || '').trim();
            nip = (cols[1] || '').trim();
            fullName = (cols[2] || '').trim();
            roleRaw = (cols[3] || 'GURU').trim();
            email = (cols[4] || '').trim();
            phone = (cols[5] || '').trim();
            mataPelajaran = (cols[6] || 'Umum').trim();
            pangkatGolongan = (cols[7] || '-').trim();
            statusKepegawaian = (cols[8] || 'PNS').trim();
            pin = (cols[9] || '123456').trim();
          } else {
            // 9 positional columns (legacy CSV): NIP, Nama, Role, Email, No HP, Mapel, Pangkat, Status, PIN
            rawLoginId = '';
            nip = (cols[0] || '').trim();
            fullName = (cols[1] || '').trim();
            roleRaw = (cols[2] || 'GURU').trim();
            email = (cols[3] || '').trim();
            phone = (cols[4] || '').trim();
            mataPelajaran = (cols[5] || 'Umum').trim();
            pangkatGolongan = (cols[6] || '-').trim();
            statusKepegawaian = (cols[7] || 'PNS').trim();
            pin = (cols[8] || '123456').trim();
          }

          // Role normalization
          let role: UserRole = 'GURU';
          let roleValid = true;
          const cleanRole = roleRaw.toUpperCase().trim().replace(/[\s-]+/g, '_');
          if (cleanRole === 'ADMIN') role = 'ADMIN';
          else if (cleanRole === 'KEPALA_SEKOLAH' || cleanRole === 'KEPSEK') role = 'KEPALA_SEKOLAH';
          else if (cleanRole === 'GURU') role = 'GURU';
          else if (
            cleanRole === 'TENAGA_KEPENDIDIKAN' ||
            cleanRole === 'STAFF' ||
            cleanRole === 'TU' ||
            cleanRole === 'TATA_USAHA'
          )
            role = 'TENAGA_KEPENDIDIKAN';
          else if (cleanRole === 'SATPAM' || cleanRole === 'KEAMANAN') role = 'SATPAM';
          else {
            role = 'GURU';
            roleValid = false;
          }

          return {
            rawLoginId,
            nip,
            nuptk,
            fullName,
            role,
            roleRaw,
            roleValid,
            email,
            phone,
            mataPelajaran: mataPelajaran || 'Umum',
            pangkatGolongan: pangkatGolongan || '-',
            statusKepegawaian: statusKepegawaian || 'PNS',
            pin: pin || '123456',
          };
        });

        // Track allocated and explicit identifiers in batch to avoid collisions
        const allocatedLoginIds = new Set<string>(currentLogins);
        const explicitLoginCounts = new Map<string, number>();
        const nipCounts = new Map<string, number>();

        rawItems.forEach((item) => {
          if (item.rawLoginId) {
            const norm = item.rawLoginId.toUpperCase();
            explicitLoginCounts.set(norm, (explicitLoginCounts.get(norm) || 0) + 1);
            allocatedLoginIds.add(norm);
          }
          if (item.nip && item.nip !== '-') {
            nipCounts.set(item.nip, (nipCounts.get(item.nip) || 0) + 1);
          }
        });

        // Second pass: synthesize auto-generated Login IDs and validate
        const rows: ParsedUserRow[] = rawItems.map((item) => {
          let loginId = item.rawLoginId.toUpperCase();
          let isGeneratedLoginId = false;

          // Auto-generate Login ID if empty, without touching item.nip
          if (!loginId) {
            let prefix = 'GURU';
            if (item.role === 'ADMIN') prefix = 'ADMIN';
            else if (item.role === 'KEPALA_SEKOLAH') prefix = 'KEPSEK';
            else if (item.role === 'SATPAM') prefix = 'SATPAM';
            else if (item.role === 'TENAGA_KEPENDIDIKAN') prefix = 'STAFF';

            let counter = 1;
            let candidate = '';
            do {
              candidate = `${prefix}-${String(counter).padStart(3, '0')}`;
              counter++;
            } while (allocatedLoginIds.has(candidate));

            allocatedLoginIds.add(candidate);
            loginId = candidate;
            isGeneratedLoginId = true;
          }

          let isValid = true;
          let error = '';

          // 1. Validate full name (required)
          if (!item.fullName) {
            isValid = false;
            error = 'Nama Lengkap wajib diisi';
          }
          // 2. Validate role
          else if (!item.roleValid) {
            isValid = false;
            error = `Peran "${item.roleRaw}" tidak valid. Pilihan: GURU, ADMIN, KEPALA_SEKOLAH, TENAGA_KEPENDIDIKAN, SATPAM`;
          }
          // 3. Validate Login ID format & collisions
          else if (!loginId) {
            isValid = false;
            error = 'ID Login tidak boleh kosong';
          } else if (loginId.length < 3 || loginId.length > 50) {
            isValid = false;
            error = `ID Login "${loginId}" harus 3-50 karakter`;
          } else if (!/^[A-Z0-9_.-]+$/.test(loginId)) {
            isValid = false;
            error = `Format ID Login "${loginId}" tidak valid (hanya huruf, angka, -, _, .)`;
          } else if (!isGeneratedLoginId && currentLogins.has(loginId)) {
            isValid = false;
            error = `ID Login "${loginId}" sudah digunakan oleh akun lain di sistem`;
          } else if (!isGeneratedLoginId && (explicitLoginCounts.get(loginId) || 0) > 1) {
            isValid = false;
            error = `ID Login "${loginId}" duplikat dalam berkas CSV`;
          }
          // 4. Validate NIP (optional, only check collisions if filled)
          else if (item.nip && item.nip !== '-') {
            if (currentNips.has(item.nip)) {
              isValid = false;
              error = `NIP "${item.nip}" sudah digunakan di database`;
            } else if ((nipCounts.get(item.nip) || 0) > 1) {
              isValid = false;
              error = `NIP "${item.nip}" duplikat dalam berkas CSV`;
            }
          }

          // 5. Validate initial PIN (must be exactly 6 numeric digits)
          const finalPin = item.pin || '123456';
          if (isValid && !/^\d{6}$/.test(finalPin)) {
            isValid = false;
            error = `PIN harus berupa 6 digit angka numerik (ditemukan: "${item.pin}")`;
          }

          return {
            loginId,
            isGeneratedLoginId,
            nip: item.nip,
            nuptk: item.nuptk,
            fullName: item.fullName,
            role: item.role,
            email: item.email,
            phone: item.phone,
            mataPelajaran: item.mataPelajaran,
            pangkatGolongan: item.pangkatGolongan,
            statusKepegawaian: item.statusKepegawaian,
            pin: finalPin,
            isValid,
            error,
          };
        });

        setParsedUsers(rows);
      } else {
        // Students CSV parsing
        const findIdx = (keywords: string[]) =>
          firstLineCols.findIndex((h) => keywords.some((k) => h.includes(k)));

        let colIdxNis = findIdx(['nis/nisn', 'nis_nisn', 'nis', 'nomor induk siswa', 'no induk']);
        let colIdxNisn = findIdx(['nisn', 'nomor induk siswa nasional', 'no nisn']);

        // Check if a single column header says 'nisn' or 'nis/nisn'
        // If colIdxNis and colIdxNisn point to the exact same column, resolve disambiguation
        if (colIdxNis === colIdxNisn && colIdxNis !== -1) {
          colIdxNis = -1; // keep colIdxNisn as candidate
        }

        const colIdxNama = findIdx(['nama lengkap', 'nama siswa', 'nama']);
        const colIdxKelas = findIdx(['kelas', 'rombel', 'rombongan']);
        const colIdxJk = findIdx(['jenis kelamin', 'gender', 'jk', 'l/p', 'l / p']);
        const colIdxHpSiswa = findIdx(['hp siswa', 'nomor hp siswa', 'telepon siswa', 'no hp siswa']);
        const colIdxHpOrtu = findIdx(['hp orang tua', 'hp ortu', 'no hp ortu', 'no hp orang tua', 'wali', 'orang tua', 'kontak ortu']);
        const colIdxAlamat = findIdx(['alamat', 'domisili', 'tempat tinggal']);

        // First pass: extract raw student column data
        interface RawStudentItem {
          rawNis: string;
          rawNisn: string;
          nama: string;
          kelas: string;
          gender: string;
          noHpSiswa: string;
          noHpOrangTua: string;
          alamat: string;
          originalIndex: number;
        }

        const rawStudentItems: RawStudentItem[] = dataLines.map((line, idx) => {
          const cols = splitLine(line);

          let rawNis = '';
          let rawNisn = '';
          let nama = '';
          let kelas = '';
          let gender = 'L';
          let noHpSiswa = '';
          let noHpOrangTua = '-';
          let alamat = '';

          if (isFirstLineHeader) {
            // Check if user has explicit separate NIS and NISN columns
            if (colIdxNis !== -1 && colIdxNisn !== -1 && colIdxNis !== colIdxNisn) {
              rawNis = cols[colIdxNis] || '';
              rawNisn = cols[colIdxNisn] || '';
            } else if (colIdxNisn !== -1) {
              // Only NISN column found
              rawNisn = cols[colIdxNisn] || '';
            } else if (colIdxNis !== -1) {
              // Only NIS column found
              rawNis = cols[colIdxNis] || '';
            } else {
              // Default fallback first col
              rawNisn = cols[0] || '';
            }

            nama = colIdxNama !== -1 ? cols[colIdxNama] || '' : cols[1] || '';
            kelas = colIdxKelas !== -1 ? cols[colIdxKelas] || 'X MIPA 1' : cols[2] || 'X MIPA 1';
            gender = colIdxJk !== -1 ? (cols[colIdxJk] || 'L').toUpperCase().trim() : (cols[3] || 'L').toUpperCase().trim();
            noHpSiswa = colIdxHpSiswa !== -1 ? (cols[colIdxHpSiswa] || '').trim() : '';
            noHpOrangTua = colIdxHpOrtu !== -1 ? cols[colIdxHpOrtu] || '-' : cols[4] || '-';
            alamat = colIdxAlamat !== -1 ? cols[colIdxAlamat] || '' : cols[5] || '';
          } else {
            // No header line: positional fallback
            if (cols.length >= 8) {
              rawNis = cols[0] || '';
              rawNisn = cols[1] || '';
              nama = cols[2] || '';
              kelas = cols[3] || 'X MIPA 1';
              gender = (cols[4] || 'L').toUpperCase().trim();
              noHpSiswa = (cols[5] || '').trim();
              noHpOrangTua = cols[6] || '-';
              alamat = cols[7] || '';
            } else if (cols.length === 7) {
              rawNisn = cols[0] || '';
              nama = cols[1] || '';
              kelas = cols[2] || 'X MIPA 1';
              gender = (cols[3] || 'L').toUpperCase().trim();
              noHpSiswa = (cols[4] || '').trim();
              noHpOrangTua = cols[5] || '-';
              alamat = cols[6] || '';
            } else {
              rawNisn = cols[0] || '';
              nama = cols[1] || '';
              kelas = cols[2] || 'X MIPA 1';
              gender = (cols[3] || 'L').toUpperCase().trim();
              noHpSiswa = '';
              noHpOrangTua = cols[4] || '-';
              alamat = cols[5] || '';
            }
          }

          return {
            rawNis: rawNis.trim(),
            rawNisn: rawNisn.trim(),
            nama: nama.trim(),
            kelas: kelas.trim() || 'X MIPA 1',
            gender,
            noHpSiswa,
            noHpOrangTua: noHpOrangTua.trim() || '-',
            alamat: alamat.trim(),
            originalIndex: idx,
          };
        });

        // Detect legacy CSV issue: single column titled "NISN" containing internal numbers like "1481/080.531"
        let remappedToNisCount = 0;
        const normalizedItems = rawStudentItems.map((item) => {
          let nis = item.rawNis;
          let nisn = item.rawNisn;
          let warning = '';

          // If NIS is empty but NISN contains non-numeric chars (like slash, dots, hyphens)
          // or is not exactly 10 digits numeric, it's an internal school NIS misfiled into NISN column
          if (!nis && nisn && !/^\d{10}$/.test(nisn)) {
            // e.g. "1481/080.531" or "080/SMK/12"
            nis = nisn;
            nisn = '';
            remappedToNisCount++;
            warning = `Nomor "${nis}" otomatis dipetakan ke NIS (Nomor Induk Siswa internal). NISN dikosongkan karena NISN nasional harus tepat 10 digit angka.`;
          }

          return {
            ...item,
            nis,
            nisn,
            warning,
          };
        });

        // Track allocated identifiers to detect duplicates within CSV and vs Firestore
        const allocatedStudentIds = new Set<string>(existingStudentIds);
        const nisCounts = new Map<string, number>();
        const nisnCounts = new Map<string, number>();

        normalizedItems.forEach((item) => {
          if (item.nis && item.nis !== '-') {
            nisCounts.set(item.nis, (nisCounts.get(item.nis) || 0) + 1);
          }
          if (item.nisn && item.nisn !== '-') {
            nisnCounts.set(item.nisn, (nisnCounts.get(item.nisn) || 0) + 1);
          }
        });

        // Second pass: validate fields and synthesize unique studentId
        let generatedSeq = 1;
        const rows: ParsedStudentRow[] = normalizedItems.map((item) => {
          let isValid = true;
          let error = '';
          let warning = item.warning || '';

          // 1. Validate full name (required)
          if (!item.nama) {
            isValid = false;
            error = 'Nama Siswa wajib diisi';
          }
          // 2. Validate class (required)
          else if (!item.kelas) {
            isValid = false;
            error = 'Kelas wajib diisi';
          }

          // 3. Validate NISN if present (must be exactly 10 numeric digits, preserving leading zeroes)
          if (isValid && item.nisn && item.nisn !== '-') {
            if (!/^\d{10}$/.test(item.nisn)) {
              isValid = false;
              error = `NISN "${item.nisn}" tidak valid. NISN nasional wajib tepat 10 digit angka (contoh: 0081234561).`;
            } else if ((nisnCounts.get(item.nisn) || 0) > 1) {
              isValid = false;
              error = `NISN "${item.nisn}" duplikat dalam berkas CSV`;
            } else if (existingStudentNisn.has(item.nisn)) {
              // Existing in DB: flag warning for update or error if conflicting
              warning = warning
                ? `${warning}; Siswa dengan NISN "${item.nisn}" sudah terdaftar di database (akan diperbarui)`
                : `Siswa dengan NISN "${item.nisn}" sudah terdaftar di database (akan diperbarui)`;
            }
          }

          // 4. Validate NIS if present
          if (isValid && item.nis && item.nis !== '-') {
            if ((nisCounts.get(item.nis) || 0) > 1) {
              isValid = false;
              error = `NIS "${item.nis}" duplikat dalam berkas CSV`;
            } else if (existingStudentNis.has(item.nis)) {
              warning = warning
                ? `${warning}; NIS "${item.nis}" sudah ada di database (akan diperbarui)`
                : `NIS "${item.nis}" sudah ada di database (akan diperbarui)`;
            }
          }

          // 5. Validate Student Phone format if filled
          if (isValid && item.noHpSiswa && !/^(\+62|62|0)8[0-9]{7,13}$/.test(item.noHpSiswa)) {
            isValid = false;
            error = `Format No. HP Siswa "${item.noHpSiswa}" tidak valid (gunakan 08... / +628...)`;
          }

          // 6. Gender parsing
          let gender = item.gender;
          if (gender !== 'L' && gender !== 'P') {
            gender = gender.startsWith('P') ? 'P' : 'L';
          }
          const jenisKelamin = gender as 'L' | 'P';

          // 7. Internal studentId generation (stable, unique, independent of NIS/NISN)
          // Priority: std-nisn if valid 10 digits, or std-cleanNIS, or std-generatedSeq
          let studentId = '';
          let isGeneratedStudentId = false;

          if (item.nisn && /^\d{10}$/.test(item.nisn)) {
            studentId = `std-${item.nisn}`;
          } else if (item.nis && item.nis !== '-') {
            // Sanitize NIS for safe document ID
            const sanitizedNis = item.nis.replace(/[^a-zA-Z0-9_-]/g, '-');
            studentId = `std-nis-${sanitizedNis}`;
          }

          // Fallback if empty or collision
          if (!studentId || allocatedStudentIds.has(studentId)) {
            while (allocatedStudentIds.has(`std-${String(generatedSeq).padStart(3, '0')}`)) {
              generatedSeq++;
            }
            studentId = `std-${String(generatedSeq).padStart(3, '0')}`;
            isGeneratedStudentId = true;
            generatedSeq++;
          }

          allocatedStudentIds.add(studentId);

          return {
            studentId,
            isGeneratedStudentId,
            nis: item.nis,
            nisn: item.nisn,
            nama: item.nama,
            kelas: item.kelas,
            jenisKelamin,
            noHpSiswa: item.noHpSiswa,
            noHpOrangTua: item.noHpOrangTua,
            alamat: item.alamat,
            isValid,
            error,
            warning,
          };
        });

        setParsedStudents(rows);
      }
    },
    [existingLoginIds, existingNips, existingStudentNis, existingStudentNisn, existingStudentIds]
  );

  // Re-parse when existing IDs are loaded or updated
  useEffect(() => {
    if (rawText) {
      parseCsvText(rawText, importType, existingLoginIds, existingNips);
    }
  }, [existingLoginIds, existingNips, existingStudentNis, existingStudentNisn, existingStudentIds, rawText, importType, parseCsvText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setRawText(content);
      parseCsvText(content, importType);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setRawText(text);
    parseCsvText(text, importType);
  };

  const handleExecuteImport = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    setImportResult(null);

    let successCount = 0;
    let failedCount = 0;

    try {
      if (importType === 'USERS_TEACHERS') {
        const validRows = parsedUsers.filter((r) => r.isValid);
        setImportProgress({ current: 0, total: validRows.length });

        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          try {
            const assignedLoginId = row.loginId.trim().toUpperCase();
            const cleanNip = (row.nip || '').trim();
            const initialPin = (row.pin || '123456').trim();

            let userId = '';

            // 1. Create user account via authenticated backend API
            // Enforces atomic loginId uniqueness in login_ids collection
            // and stores PIN securely in backend CredentialStore (scrypt adaptive hash)
            const apiRes = await authService.createUserProfile({
              loginId: assignedLoginId,
              fullName: row.fullName.trim(),
              role: row.role,
              nip: cleanNip,
              nuptk: (row.nuptk || '').trim(),
              email: (row.email || '').trim(),
              phone: (row.phone || '').trim(),
              initialPin,
              isActive: true,
            });

            if (apiRes.success && apiRes.user) {
              userId = apiRes.user.id;
            } else if (apiRes.code === 'DUPLICATE_LOGIN_ID') {
              throw new Error(apiRes.error || `ID Login '${assignedLoginId}' sudah digunakan.`);
            } else {
              // Direct fallback (e.g. offline / local resilience)
              userId = `usr-${row.role.toLowerCase()}-${Date.now().toString(36)}-${i}`;
              let permissions: string[] = [
                'dashboard.view',
                'schedule.view',
                'attendance.view',
                'attendance.create',
                'dutybook.view',
                'dutybook.create',
                'incident.view',
                'incident.create',
              ];
              if (row.role === 'ADMIN') permissions = ['*'];
              else if (row.role === 'KEPALA_SEKOLAH')
                permissions = [
                  'dashboard.view',
                  'schedule.view',
                  'attendance.view',
                  'dutybook.view',
                  'dutybook.verify',
                  'dutybook.unlock',
                  'reports.view',
                  'reports.export',
                ];
              else if (row.role === 'SATPAM')
                permissions = ['dashboard.view', 'schedule.view', 'attendance.view', 'attendance.create', 'incident.view', 'incident.create'];

              const newUser: UserProfile = {
                id: userId,
                loginId: assignedLoginId,
                nip: cleanNip,
                nuptk: (row.nuptk || '').trim(),
                fullName: row.fullName.trim(),
                role: row.role,
                email: (row.email || '').trim(),
                phone: (row.phone || '').trim(),
                isActive: true,
                permissions,
                requiresActivation: false,
                sessionRevokedAtSeconds: Math.floor(Date.now() / 1000),
                dataSource: 'PRODUCTION',
                isDemo: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await FirestoreService.setDocument('users', userId, newUser);

              // Store initial PIN in backend CredentialStore via resetUserPin
              await authService.resetUserPin(userId, initialPin);
            }

            // 2. Synchronize master teacher record using robust userId document ID (independent of empty NIP)
            if (row.role === 'GURU') {
              const teacherId = `tch-${userId}`;
              const teacherRecord: TeacherRecord = {
                id: teacherId,
                userId,
                nip: cleanNip,
                nuptk: (row.nuptk || '').trim() || undefined,
                idGuru: assignedLoginId,
                fullName: row.fullName.trim(),
                mataPelajaran: row.mataPelajaran || 'Umum',
                pangkatGolongan: row.pangkatGolongan || 'Penata Muda / IIIa',
                statusKepegawaian: row.statusKepegawaian || 'PNS',
                phone: (row.phone || '').trim(),
                email: (row.email || '').trim(),
                createdAt: new Date().toISOString(),
                createdBy: currentUser.fullName,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.fullName,
              };
              await FirestoreService.setDocument('teachers', teacherId, teacherRecord);
            } else if (row.role === 'TENAGA_KEPENDIDIKAN' || row.role === 'SATPAM') {
              // 3. Synchronize master staff record using robust userId document ID
              const staffId = `stf-${userId}`;
              const staffRecord: StaffRecord = {
                id: staffId,
                userId,
                nip: cleanNip,
                fullName: row.fullName.trim(),
                divisi: row.role === 'SATPAM' ? 'Keamanan/Satpam' : 'Tata Usaha',
                jabatan: row.role === 'SATPAM' ? 'Petugas Keamanan' : 'Staf Administrasi',
                statusKepegawaian: row.statusKepegawaian || 'PTT',
                phone: (row.phone || '').trim(),
                createdAt: new Date().toISOString(),
                createdBy: currentUser.fullName,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.fullName,
              };
              await FirestoreService.setDocument('staff', staffId, staffRecord);
            }

            successCount++;
          } catch (err) {
            console.error(`Error importing user row ${i} (${row.fullName}):`, err);
            failedCount++;
          }

          setImportProgress({ current: i + 1, total: validRows.length });
        }

        // Refresh user cache in AuthService
        await authService.refreshUsersList();

        // Audit Log
        await FirestoreService.logAudit({
          userId: currentUser.id,
          userName: currentUser.fullName,
          role: currentUser.role,
          action: 'IMPORT',
          module: 'USERS',
          details: `Import massal data akun & guru: ${successCount} berhasil, ${failedCount} gagal`,
        });
      } else {
        // Students Import
        const validRows = parsedStudents.filter((r) => r.isValid);
        setImportProgress({ current: 0, total: validRows.length });

        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          try {
            const docId = row.studentId;
            const studentRecord: StudentRecord = {
              id: docId,
              studentId: row.studentId,
              nis: row.nis || undefined,
              nisn: row.nisn || undefined,
              nama: row.nama,
              kelas: row.kelas,
              jenisKelamin: row.jenisKelamin,
              noHpSiswa: (row.noHpSiswa || '').trim() || undefined,
              noHpOrangTua: row.noHpOrangTua,
              alamat: row.alamat,
              isActive: true,
              createdAt: new Date().toISOString(),
              createdBy: currentUser.fullName,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.fullName,
            };

            await FirestoreService.setDocument('students', docId, studentRecord);
            successCount++;
          } catch (err) {
            console.error('Error importing student row:', err);
            failedCount++;
          }

          setImportProgress({ current: i + 1, total: validRows.length });
        }

        // Audit Log
        await FirestoreService.logAudit({
          userId: currentUser.id,
          userName: currentUser.fullName,
          role: currentUser.role,
          action: 'IMPORT',
          module: 'STUDENTS' as any,
          details: `Import massal data siswa: ${successCount} berhasil, ${failedCount} gagal`,
        });
      }

      setImportResult({ success: successCount, failed: failedCount });
      if (onSuccess) {
        onSuccess();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount =
    importType === 'USERS_TEACHERS'
      ? parsedUsers.filter((u) => u.isValid).length
      : parsedStudents.filter((s) => s.isValid).length;

  const totalCount =
    importType === 'USERS_TEACHERS' ? parsedUsers.length : parsedStudents.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Data Massal (Bulk Import CSV)"
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Type Switcher */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setImportType('USERS_TEACHERS');
              setRawText('');
              setParsedUsers([]);
              setParsedStudents([]);
              setImportResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              importType === 'USERS_TEACHERS'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Guru & Pengguna (Akun Sistem)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setImportType('STUDENTS');
              setRawText('');
              setParsedUsers([]);
              setParsedStudents([]);
              setImportResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              importType === 'STUDENTS'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Data Siswa (Rombel / Kelas)</span>
          </button>
        </div>

        {/* Guidance and Template Download */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="font-bold text-blue-900 dark:text-blue-200">
              {importType === 'USERS_TEACHERS'
                ? 'Format Berkas Data Guru & Pengguna'
                : 'Format Berkas Data Siswa'}
            </span>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              {importType === 'USERS_TEACHERS'
                ? 'Kolom: ID Login (opsional/otomatis), NIP (opsional), Nama Lengkap (wajib), Role (GURU/ADMIN/dll), Email, No HP, Mapel, Pangkat, Status, PIN Awal (6 digit, default: 123456).'
                : 'Kolom: NIS (internal sekolah, opsional), NISN (nasional 10 digit, opsional), Nama Lengkap (wajib), Kelas (wajib), Jenis Kelamin (L/P), No HP Orang Tua, Alamat.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 text-xs bg-white dark:bg-slate-900"
            leftIcon={<Download className="w-3.5 h-3.5 text-blue-600" />}
            onClick={handleDownloadTemplate}
          >
            Unduh Template .CSV
          </Button>
        </div>

        {/* Upload File or Paste CSV */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Unggah Berkas .CSV atau Tempel (Paste) Teks CSV
            </label>
            {fileName && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                <Check className="w-3 h-3" /> {fileName}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <label className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Pilih Berkas CSV dari Komputer
              </span>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          <div>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={
                importType === 'USERS_TEACHERS'
                  ? 'Atau tempel baris CSV di sini...\nContoh (ID Login, NIP [opsional], Nama, Role, Email, No HP, Mapel, Pangkat, Status, PIN):\nGURU-001,198501012010011001,Dra. Siti Aminah,GURU,siti@sekolah.sch.id,081234567891,Bahasa Indonesia,Pembina / IVa,PNS,123456\nGURU-002,,Budi Santoso S.Pd,GURU,budi@sekolah.sch.id,081234567892,Matematika,-,Honorer,123456'
                  : 'Atau tempel baris CSV di sini...\nContoh (NIS, NISN, Nama, Kelas, L/P, HP Siswa, HP Ortu, Alamat):\n1481/080.531,0081234561,Ahmad Pratama,X MIPA 1,L,081298765401,081234567890,Jl. Merdeka No. 10\n1482/080.532,,Dewi Anggraini,X MIPA 1,P,,081234567891,Jl. Melati No. 4\n,0081234563,Fajar Nugroho,X IPS 2,L,081298765403,081234567892,Jl. Anggrek No. 12'
              }
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Data Preview */}
        {totalCount > 0 && (
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">Pratinjau Data</span>
                <Badge variant="primary" size="sm">
                  {validCount} / {totalCount} Baris Valid
                </Badge>
              </div>
              {totalCount > validCount && (
                <span className="text-[11px] text-rose-500 font-medium">
                  {totalCount - validCount} baris memiliki kesalahan dan akan dilewati.
                </span>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              {importType === 'USERS_TEACHERS' ? (
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">ID Login</th>
                      <th className="p-2">NIP</th>
                      <th className="p-2">Nama Lengkap</th>
                      <th className="p-2">Role</th>
                      <th className="p-2">PIN Awal</th>
                      <th className="p-2">Kontak</th>
                      <th className="p-2">Kepegawaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedUsers.map((u, i) => (
                      <tr
                        key={i}
                        className={u.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/50 text-rose-900'}
                      >
                        <td className="p-2 whitespace-nowrap">
                          {u.isValid ? (
                            <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-[10px]">Valid</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-rose-600 font-bold" title={u.error}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                              <span className="text-[10px] max-w-[140px] truncate">{u.error || 'Error'}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                          {u.loginId}
                          {u.isGeneratedLoginId && (
                            <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-sans font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                              Otomatis
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {u.nip || <span className="text-slate-400 dark:text-slate-500 italic">-</span>}
                        </td>
                        <td className="p-2 font-bold whitespace-nowrap">{u.fullName || '-'}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold text-[10px]">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {u.pin || '123456'}
                        </td>
                        <td className="p-2 whitespace-nowrap font-mono">{u.phone || u.email || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{u.statusKepegawaian || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">ID Siswa</th>
                      <th className="p-2">NIS (Sekolah)</th>
                      <th className="p-2">NISN (Nasional)</th>
                      <th className="p-2">Nama Siswa</th>
                      <th className="p-2">Kelas</th>
                      <th className="p-2">L/P</th>
                      <th className="p-2">No. HP Siswa</th>
                      <th className="p-2">No. HP Ortu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedStudents.map((s, i) => (
                      <tr
                        key={i}
                        className={s.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/50 text-rose-900'}
                      >
                        <td className="p-2 whitespace-nowrap">
                          {s.isValid ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px]">Valid</span>
                              </div>
                              {s.warning && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium max-w-[130px] truncate" title={s.warning}>
                                  ⚠️ {s.warning}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-rose-600 font-bold" title={s.error}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                              <span className="text-[10px] max-w-[140px] truncate">{s.error || 'Error'}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap text-slate-800 dark:text-slate-200">
                          {s.studentId}
                          {s.isGeneratedStudentId && (
                            <span className="ml-1 px-1 py-0.2 rounded text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500">
                              Auto
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                          {s.nis || <span className="text-slate-400 dark:text-slate-500 italic">-</span>}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap text-slate-900 dark:text-slate-100 font-semibold">
                          {s.nisn || <span className="text-slate-400 dark:text-slate-500 italic">-</span>}
                        </td>
                        <td className="p-2 font-bold whitespace-nowrap">{s.nama || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{s.kelas || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{s.jenisKelamin}</td>
                        <td className="p-2 whitespace-nowrap font-mono">{s.noHpSiswa || '-'}</td>
                        <td className="p-2 whitespace-nowrap font-mono">{s.noHpOrangTua || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar & Result */}
        {importProgress && (
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
              <span>Menyimpan ke Database Firestore & Layanan Kredensial...</span>
              <span>
                {importProgress.current} / {importProgress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{
                  width: `${(importProgress.current / (importProgress.total || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {importResult && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold">
                Import Berhasil Selesai: {importResult.success} data tersimpan
                {importResult.failed > 0 && `, ${importResult.failed} gagal`}!
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Selesai & Tutup
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isProcessing}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleExecuteImport}
            disabled={validCount === 0 || isProcessing}
            isLoading={isProcessing}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            {isProcessing ? 'Mengimpor Data...' : `Mulai Import (${validCount} Data)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
