// Alfabeto sin caracteres ambiguos (sin O, 0, I, 1, L)
const SAFE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 5, randomFn: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(randomFn() * SAFE_ALPHABET.length) % SAFE_ALPHABET.length;
    code += SAFE_ALPHABET[idx];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export function isValidRoomCode(code: string): boolean {
  const normalized = normalizeRoomCode(code);
  return normalized.length >= 4 && normalized.length <= 6;
}
