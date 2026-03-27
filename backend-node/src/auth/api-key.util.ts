import * as crypto from 'crypto';

const API_KEY_PREFIX = 'ck_live_';
const API_KEY_BYTES = 32;

export function generateApiKeyToken(): string {
  return `${API_KEY_PREFIX}${crypto.randomBytes(API_KEY_BYTES).toString('hex')}`;
}

export function apiKeyPrefix(token: string): string {
  return token.slice(0, 16);
}

export function hashApiKey(token: string): string {
  const pepper = (process.env.API_KEY_PEPPER || '').trim();
  return crypto.createHash('sha256').update(`${token}:${pepper}`).digest('hex');
}

export function isReadOnlyMethod(method: string): boolean {
  const normalized = (method || '').toUpperCase();
  return (
    normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS'
  );
}
