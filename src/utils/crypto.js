import crypto from 'node:crypto';
import env from '../config/env.js';

// Tenant SMTP app passwords must be stored reversibly (SMTP auth needs the
// plaintext), so we encrypt them at rest with AES-256-GCM. The 32-byte key is
// derived from JWT_SECRET — no extra env var required. Rotating JWT_SECRET
// therefore invalidates stored passwords; tenants would re-enter them.
const KEY = crypto.createHash('sha256').update(env.JWT_SECRET).digest();
const ALGORITHM = 'aes-256-gcm';

// Stored format: "<iv-hex>:<authTag-hex>:<ciphertext-hex>"
export const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

export const decrypt = (payload) => {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};
