import React, { useState } from 'react';
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
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, UserRole } from '../../types';
import { TeacherRecord, StudentRecord, StaffRecord } from '../../types/master.types';
import { hashPinWithSalt, generateSalt } from '../../utils/cryptoUtils';

export type ImportType = 'USERS_TEACHERS' | 'STUDENTS';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: ImportType;
  onSuccess?: () => void;
}

interface ParsedUserRow {
  nip: string;
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
  nisn: string;
  nama: string;
  kelas: string;
  jenisKelamin: 'L' | 'P';
  noHpOrangTua: string;
  alamat: string;
  isValid: boolean;
  error?: string;
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

  // Reset when opening / switching type
  React.useEffect(() => {
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
      const csvHeader = 'NIP,Nama Lengkap,Role,Email,No HP,Mata Pelajaran,Pangkat Golongan,Status Kepegawaian,PIN Awal\n';
      const csvRows = [
        '198503152010011002,Dra. Siti Aminah M.Pd,GURU,siti.aminah@sekolah.sch.id,081234567891,Bahasa Indonesia,Pembina / IVa,PNS,123456',
        '199008222019032008,Budi Santoso S.Pd,GURU,budi.santoso@sekolah.sch.id,081234567892,Matematika,Penata Muda / IIIa,PPPK,123456',
        '199512142022041005,Ahmad Fauzi S.Kom,TENAGA_KEPENDIDIKAN,ahmad.fauzi@sekolah.sch.id,081234567893,-,-,Honorer,123456',
        '199304102021021004,Rian Kurniawan,SATPAM,rian.kurniawan@sekolah.sch.id,081234567894,-,-,PTT,123456',
      ].join('\n');
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Import_Guru_Pengguna_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csvHeader = 'NISN,Nama Lengkap,Kelas,Jenis Kelamin,No HP Orang Tua,Alamat\n';
      const csvRows = [
        '0081234561,Ahmad Pratama,X MIPA 1,L,081234567890,Jl. Merdeka No. 10',
        '0081234562,Dewi Anggraini,X MIPA 1,P,081234567891,Jl. Melati No. 4',
        '0081234563,Fajar Nugroho,X IPS 2,L,081234567892,Jl. Anggrek No. 12',
        '0071234564,Siti Nurhaliza,XI MIPA 2,P,081234567893,Jl. Kenanga No. 8',
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

  const parseCsvText = (text: string, type: ImportType) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setParsedUsers([]);
      setParsedStudents([]);
      return;
    }

    // Skip header line if it looks like header
    const firstLineLower = lines[0].toLowerCase();
    const dataLines =
      firstLineLower.includes('nip') || firstLineLower.includes('nisn') || firstLineLower.includes('nama')
        ? lines.slice(1)
        : lines;

    const splitLine = (line: string): string[] => {
      // Support comma or semicolon
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

    if (type === 'USERS_TEACHERS') {
      const rows: ParsedUserRow[] = dataLines.map((line) => {
        const cols = splitLine(line);
        const nip = cols[0] || '';
        const fullName = cols[1] || '';
        let roleRaw = (cols[2] || 'GURU').toUpperCase().trim();
        if (!['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'].includes(roleRaw)) {
          roleRaw = 'GURU';
        }
        const role = roleRaw as UserRole;
        const email = cols[3] || '';
        const phone = cols[4] || '';
        const mataPelajaran = cols[5] || 'Umum';
        const pangkatGolongan = cols[6] || 'Penata Muda / IIIa';
        const statusKepegawaian = cols[7] || 'PNS';
        const pin = cols[8] || '123456';

        let isValid = true;
        let error = '';
        if (!nip) {
          isValid = false;
          error = 'NIP tidak boleh kosong';
        } else if (!fullName) {
          isValid = false;
          error = 'Nama Lengkap tidak boleh kosong';
        }

        return {
          nip,
          fullName,
          role,
          email,
          phone,
          mataPelajaran,
          pangkatGolongan,
          statusKepegawaian,
          pin,
          isValid,
          error,
        };
      });
      setParsedUsers(rows);
    } else {
      const rows: ParsedStudentRow[] = dataLines.map((line) => {
        const cols = splitLine(line);
        const nisn = cols[0] || '';
        const nama = cols[1] || '';
        const kelas = cols[2] || 'X MIPA 1';
        let gender = (cols[3] || 'L').toUpperCase().trim();
        if (gender !== 'L' && gender !== 'P') {
          gender = gender.startsWith('P') ? 'P' : 'L';
        }
        const jenisKelamin = gender as 'L' | 'P';
        const noHpOrangTua = cols[4] || '-';
        const alamat = cols[5] || '';

        let isValid = true;
        let error = '';
        if (!nisn) {
          isValid = false;
          error = 'NISN tidak boleh kosong';
        } else if (!nama) {
          isValid = false;
          error = 'Nama Siswa tidak boleh kosong';
        } else if (!kelas) {
          isValid = false;
          error = 'Kelas tidak boleh kosong';
        }

        return {
          nisn,
          nama,
          kelas,
          jenisKelamin,
          noHpOrangTua,
          alamat,
          isValid,
          error,
        };
      });
      setParsedStudents(rows);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
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
            const userId = `usr-${row.role.toLowerCase()}-${Date.now().toString(36)}-${i}`;
            const pinSalt = generateSalt();
            const pinHash = await hashPinWithSalt(row.pin || '123456', pinSalt);

            // Default permissions based on role
            let permissions: string[] = ['input_duty_book', 'report_incidents', 'view_reports'];
            if (row.role === 'ADMIN') {
              permissions = ['*'];
            } else if (row.role === 'KEPALA_SEKOLAH') {
              permissions = ['approve_duty_book', 'view_reports', 'export_data', 'report_incidents'];
            } else if (row.role === 'SATPAM') {
              permissions = ['report_incidents'];
            }

            const newUser: UserProfile = {
              id: userId,
              nip: row.nip,
              fullName: row.fullName,
              role: row.role,
              email: row.email,
              phone: row.phone,
              isActive: true,
              permissions,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Save to users collection
            await FirestoreService.setDocument('users', userId, newUser);

            // Also create teacher record if role is GURU
            if (row.role === 'GURU') {
              const teacherId = `tch-${row.nip}`;
              const teacherRecord: TeacherRecord = {
                id: teacherId,
                userId,
                nip: row.nip,
                fullName: row.fullName,
                mataPelajaran: row.mataPelajaran || 'Umum',
                pangkatGolongan: row.pangkatGolongan || 'Penata Muda / IIIa',
                statusKepegawaian: row.statusKepegawaian || 'PNS',
                phone: row.phone,
                email: row.email,
                createdAt: new Date().toISOString(),
                createdBy: currentUser.fullName,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.fullName,
              };
              await FirestoreService.setDocument('teachers', teacherId, teacherRecord);
            } else if (row.role === 'TENAGA_KEPENDIDIKAN' || row.role === 'SATPAM') {
              const staffId = `stf-${row.nip}`;
              const staffRecord: StaffRecord = {
                id: staffId,
                userId,
                nip: row.nip,
                fullName: row.fullName,
                divisi: row.role === 'SATPAM' ? 'Keamanan/Satpam' : 'Tata Usaha',
                jabatan: row.role === 'SATPAM' ? 'Petugas Keamanan' : 'Staf Administrasi',
                statusKepegawaian: row.statusKepegawaian || 'PTT',
                phone: row.phone,
                createdAt: new Date().toISOString(),
                createdBy: currentUser.fullName,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.fullName,
              };
              await FirestoreService.setDocument('staff', staffId, staffRecord);
            }

            successCount++;
          } catch (err) {
            console.error('Error importing user row:', err);
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
            const studentId = `std-${row.nisn}`;
            const studentRecord: StudentRecord = {
              id: studentId,
              nisn: row.nisn,
              nama: row.nama,
              kelas: row.kelas,
              jenisKelamin: row.jenisKelamin,
              noHpOrangTua: row.noHpOrangTua,
              alamat: row.alamat,
              isActive: true,
              createdAt: new Date().toISOString(),
              createdBy: currentUser.fullName,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.fullName,
            };

            await FirestoreService.setDocument('students', studentId, studentRecord);
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
                ? 'Kolom: NIP, Nama Lengkap, Role (GURU/ADMIN/dll), Email, No HP, Mapel, Pangkat, Status, PIN (default: 123456).'
                : 'Kolom: NISN, Nama Lengkap, Kelas, Jenis Kelamin (L/P), No HP Orang Tua, Alamat.'}
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
                  ? 'Atau tempel baris CSV di sini...\nContoh:\n198501012010011001,Dra. Siti Aminah,GURU,siti@sekolah.sch.id,081234567891,Bahasa Indonesia,Pembina / IVa,PNS,123456'
                  : 'Atau tempel baris CSV di sini...\nContoh:\n0081234561,Ahmad Pratama,X MIPA 1,L,081234567890,Jl. Merdeka No. 10'
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

            <div className="max-h-48 overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              {importType === 'USERS_TEACHERS' ? (
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">NIP</th>
                      <th className="p-2">Nama Lengkap</th>
                      <th className="p-2">Role</th>
                      <th className="p-2">Kontak</th>
                      <th className="p-2">Kepegawaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedUsers.map((u, i) => (
                      <tr
                        key={i}
                        className={u.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/40 text-rose-800'}
                      >
                        <td className="p-2 whitespace-nowrap">
                          {u.isValid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="text-rose-500 font-bold" title={u.error}>
                              ✕ Error
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap">{u.nip || '-'}</td>
                        <td className="p-2 font-bold whitespace-nowrap">{u.fullName || '-'}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold text-[10px]">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap font-mono">{u.phone || u.email || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{u.statusKepegawaian || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">NISN</th>
                      <th className="p-2">Nama Siswa</th>
                      <th className="p-2">Kelas</th>
                      <th className="p-2">L/P</th>
                      <th className="p-2">No. HP Ortu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedStudents.map((s, i) => (
                      <tr
                        key={i}
                        className={s.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/40 text-rose-800'}
                      >
                        <td className="p-2 whitespace-nowrap">
                          {s.isValid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <span className="text-rose-500 font-bold" title={s.error}>
                              ✕ Error
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap">{s.nisn || '-'}</td>
                        <td className="p-2 font-bold whitespace-nowrap">{s.nama || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{s.kelas || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{s.jenisKelamin}</td>
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
              <span>Menyimpan ke Database Firestore...</span>
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
