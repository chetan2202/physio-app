// Device-local identity. Which member record "is me" is a property of THIS device, not of the
// clinic data — so it must not travel through the sync bundle. The synced Member records still
// carry an isCurrentUser flag (used as a fallback for existing single-device installs and JSON
// restores), but the persisted id below takes precedence, so a staff device that merges the
// admin's bundle stays "the staff member", not the admin.

const KEY = "physio.currentMemberId";

export function getCurrentMemberId(): string | undefined {
  try { return localStorage.getItem(KEY) ?? undefined; } catch { return undefined; }
}

export function setCurrentMemberId(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
}
