const nicknameKey = 'arah-nickname';

export const nicknameHelp = 'Gunakan 2–24 karakter: huruf, angka, spasi, titik, garis bawah, atau tanda hubung.';

export function normalizeNickname(value) {
  const name = typeof value === 'string' ? value.normalize('NFC').trim().replace(/ +/g, ' ') : '';
  return /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.-]{1,23}$/u.test(name) ? name : '';
}

export function getNickname() {
  try { return localStorage.getItem(nicknameKey) || ''; }
  catch { return ''; }
}

export function saveNickname(name) {
  localStorage.setItem(nicknameKey, name);
}
