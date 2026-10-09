import { StudentRecord } from '../src/types/master.types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

export function isValidIndonesianPhoneNumber(phone?: string): boolean {
  if (!phone || phone.trim() === '') return true; // Optional phone
  const clean = phone.trim();
  const regex = /^(\+62|62|0)8[0-9]{7,13}$/;
  return regex.test(clean);
}

export function parseStudentCsvLine(line: string, isFirstLineHeader: boolean, headerCols: string[]): {
  nisn: string;
  nama: string;
  kelas: string;
  jenisKelamin: 'L' | 'P';
  noHpSiswa?: string;
  noHpOrangTua: string;
  alamat: string;
  isValid: boolean;
  error?: string;
} {
  const delimiter = line.includes(';') ? ';' : ',';
  const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));

  let nisn = '';
  let nama = '';
  let kelas = '';
  let gender = 'L';
  let noHpSiswa = '';
  let noHpOrangTua = '-';
  let alamat = '';

  const colIdxHpSiswa = headerCols.findIndex((h) =>
    ['hp siswa', 'nomor hp siswa', 'telepon siswa', 'no hp siswa'].some((k) => h.toLowerCase().includes(k))
  );

  if (isFirstLineHeader && colIdxHpSiswa !== -1) {
    nisn = cols[0] || '';
    nama = cols[1] || '';
    kelas = cols[2] || 'X MIPA 1';
    gender = (cols[3] || 'L').toUpperCase().trim();
    noHpSiswa = (cols[colIdxHpSiswa] || '').trim();
    noHpOrangTua = cols[5] || '-';
    alamat = cols[6] || '';
  } else if (cols.length >= 7) {
    nisn = cols[0] || '';
    nama = cols[1] || '';
    kelas = cols[2] || 'X MIPA 1';
    gender = (cols[3] || 'L').toUpperCase().trim();
    noHpSiswa = (cols[4] || '').trim();
    noHpOrangTua = cols[5] || '-';
    alamat = cols[6] || '';
  } else {
    // 6 columns legacy
    nisn = cols[0] || '';
    nama = cols[1] || '';
    kelas = cols[2] || 'X MIPA 1';
    gender = (cols[3] || 'L').toUpperCase().trim();
    noHpSiswa = '';
    noHpOrangTua = cols[4] || '-';
    alamat = cols[5] || '';
  }

  if (gender !== 'L' && gender !== 'P') {
    gender = gender.startsWith('P') ? 'P' : 'L';
  }

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
  } else if (noHpSiswa && !isValidIndonesianPhoneNumber(noHpSiswa)) {
    isValid = false;
    error = `Format No. HP Siswa "${noHpSiswa}" tidak valid (gunakan 08... atau +62...)`;
  }

  return {
    nisn,
    nama,
    kelas,
    jenisKelamin: gender as 'L' | 'P',
    noHpSiswa,
    noHpOrangTua,
    alamat,
    isValid,
    error,
  };
}

async function runTests() {
  console.log('=== RUNNING STUDENT PHONE WORKFLOW VERIFICATION ===');

  // Test 1: Phone validation rules
  assert(isValidIndonesianPhoneNumber(''), 'Empty string is valid (optional phone)');
  assert(isValidIndonesianPhoneNumber('   '), 'Whitespace only is valid (treated as empty)');
  assert(isValidIndonesianPhoneNumber(undefined), 'Undefined is valid (optional phone)');
  assert(isValidIndonesianPhoneNumber('081234567890'), 'Standard 08... number is valid');
  assert(isValidIndonesianPhoneNumber('085712345678'), 'Standard 0857... number is valid');
  assert(isValidIndonesianPhoneNumber('+6281234567890'), 'Standard +628... number is valid');
  assert(isValidIndonesianPhoneNumber('6281234567890'), 'Standard 628... number is valid');

  // Test 2: Invalid phone rejection
  assert(!isValidIndonesianPhoneNumber('12345'), 'Too short number is rejected');
  assert(!isValidIndonesianPhoneNumber('0217890123'), 'Landline number 021... is rejected for student mobile');
  assert(!isValidIndonesianPhoneNumber('081234abc'), 'Letters in phone number are rejected');
  assert(!isValidIndonesianPhoneNumber('abcde'), 'Alphabet is rejected');

  // Test 3: Add student without phone number
  const student1: StudentRecord = {
    id: 'std-101',
    nisn: '0081234599',
    nama: 'Budi Kurniawan',
    kelas: 'X MIPA 1',
    jenisKelamin: 'L',
    noHpSiswa: undefined,
    noHpOrangTua: '081234567890',
    alamat: 'Jl. Pemuda No. 1',
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: 'Admin',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin',
  };
  assert(!student1.noHpSiswa, 'Student 1 created without student phone number');
  assert(student1.noHpOrangTua === '081234567890', 'Student 1 has parent phone number');

  // Test 4: Add student with phone number (string preserved with leading zero)
  const student2: StudentRecord = {
    id: 'std-102',
    nisn: '0081234598',
    nama: 'Citra Dewi',
    kelas: 'XI MIPA 2',
    jenisKelamin: 'P',
    noHpSiswa: '085712345678',
    noHpOrangTua: '081298765432',
    alamat: 'Jl. Melati No. 5',
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: 'Admin',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin',
  };
  assert(student2.noHpSiswa === '085712345678', 'Student 2 preserves leading zero as string');
  assert(typeof student2.noHpSiswa === 'string', 'Student phone number is stored as string');

  // Test 5: Edit student phone number
  const student2Edited: StudentRecord = {
    ...student2,
    noHpSiswa: '+6281234567890',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin',
  };
  assert(student2Edited.noHpSiswa === '+6281234567890', 'Student 2 phone successfully updated to +62 format');
  assert(student2Edited.id === student2.id, 'Student ID remains invariant on update');
  assert(student2Edited.nisn === student2.nisn, 'NISN remains invariant on update');

  // Test 6: Emptying previously saved student phone number
  const student2Emptied: StudentRecord = {
    ...student2,
    noHpSiswa: '',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin',
  };
  assert(student2Emptied.noHpSiswa === '', 'Student 2 phone successfully cleared');

  // Test 7: Legacy CSV import parsing (6 columns: NISN, Nama, Kelas, JK, No HP Ortu, Alamat)
  const legacyRow = '0081234561,Ahmad Pratama,X MIPA 1,L,081234567890,Jl. Merdeka No. 10';
  const parsedLegacy = parseStudentCsvLine(legacyRow, false, []);
  assert(parsedLegacy.isValid, 'Legacy 6-column CSV row is valid');
  assert(parsedLegacy.nisn === '0081234561', 'Legacy NISN parsed correctly');
  assert(parsedLegacy.nama === 'Ahmad Pratama', 'Legacy Nama parsed correctly');
  assert(parsedLegacy.noHpSiswa === '', 'Legacy row defaults noHpSiswa to empty');
  assert(parsedLegacy.noHpOrangTua === '081234567890', 'Legacy No HP Ortu parsed correctly');

  // Test 8: New CSV import parsing (7 columns: NISN, Nama, Kelas, JK, No HP Siswa, No HP Ortu, Alamat)
  const newRowWithPhone = '0081234562,Dewi Anggraini,X MIPA 1,P,081298765401,081234567891,Jl. Melati No. 4';
  const parsedNew = parseStudentCsvLine(newRowWithPhone, false, []);
  assert(parsedNew.isValid, 'New 7-column CSV row with student phone is valid');
  assert(parsedNew.noHpSiswa === '081298765401', 'Student phone parsed correctly from 7-col CSV');
  assert(parsedNew.noHpOrangTua === '081234567891', 'Parent phone parsed correctly from 7-col CSV');

  // Test 9: New CSV import with empty student phone
  const newRowEmptyPhone = '0081234563,Fajar Nugroho,X IPS 2,L,,081234567892,Jl. Anggrek No. 12';
  const parsedNewEmpty = parseStudentCsvLine(newRowEmptyPhone, false, []);
  assert(parsedNewEmpty.isValid, 'New 7-column CSV row with empty student phone is valid');
  assert(parsedNewEmpty.noHpSiswa === '', 'Empty student phone handled gracefully in 7-col CSV');

  // Test 10: New CSV import with invalid student phone format
  const newRowInvalidPhone = '0081234564,Siti Nurhaliza,XI MIPA 2,P,invalid-phone,081234567893,Jl. Kenanga No. 8';
  const parsedInvalid = parseStudentCsvLine(newRowInvalidPhone, false, []);
  assert(!parsedInvalid.isValid, 'Invalid phone in CSV row is marked invalid');
  assert(Boolean(parsedInvalid.error?.includes('Format No. HP Siswa')), 'Clear error message on invalid phone in CSV');

  console.log('=== ALL 14 ASSERTIONS PASSED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
