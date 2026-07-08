const PREFIX = 'pharmaos_';

export function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

export function getLocal<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(`${PREFIX}${key}`);
    return item ? (JSON.parse(item) as T) : null;
  } catch {
    return null;
  }
}

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // unavailable
  }
}

export function clearLocal(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // unavailable
  }
}
