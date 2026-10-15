import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from the environment variable or fallback secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.DRIVE_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'PIKET_GURU_DEFAULT_DRIVE_ENCRYPTION_SECRET_KEY_32B';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string (e.g. OAuth Refresh Token) into AES-256-GCM hex string format.
 */
export function encryptToken(text: string): string {
  if (!text) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Ciphertext into single base64 string
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts an AES-256-GCM base64 string back into original plaintext string.
 */
export function decryptToken(encryptedBase64: string): string {
  if (!encryptedBase64) return '';
  try {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedBase64, 'base64');

    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted payload length.');
    }

    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[TOKEN_ENCRYPTION] Failed to decrypt token:', err);
    return '';
  }
}
