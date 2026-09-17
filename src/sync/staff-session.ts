// A staff device is not "activated" with a PHY code — it joined by scanning the admin's
// staff-token QR. That QR carries the clinic's Drive coordinates (client id + folder), which we
// keep so the staff device can re-sync later by scanning a fresh 1-hour token (tokens expire; the
// clinic data stays local between syncs). No token is stored — only the folder coordinates.

export interface StaffSession {
  clientId: string;
  folderName?: string;
  clinic?: string;
}

// What the admin's "Share with staff" QR encodes.
export interface StaffTokenPayload {
  t: "physio-staff-token";
  token: string;
  clientId: string;
  folderName?: string;
  clinic?: string;
  at: number;
}

const KEY = "physio.staffSession";

export function getStaffSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

export function setStaffSession(s: StaffSession): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

// Parse and validate a scanned/pasted staff-token payload.
export function parseStaffToken(raw: string): StaffTokenPayload {
  let payload: StaffTokenPayload;
  try {
    payload = JSON.parse(raw.trim()) as StaffTokenPayload;
  } catch {
    throw new Error("That code could not be read.");
  }
  if (payload?.t !== "physio-staff-token" || !payload.token || !payload.clientId) {
    throw new Error("That is not a clinic sync code.");
  }
  return payload;
}
