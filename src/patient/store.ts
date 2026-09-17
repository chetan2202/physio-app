// The patient app stores the received family record locally (read-only snapshot). A device is
// in "patient mode" either because a record is present, or because the user chose "I'm a
// patient" on the setup screen (so a fresh patient device survives a reload before its first
// code is received).

import type { FamilyBundle } from "./bundle.js";

const KEY = "physio.patientData";
const MODE_KEY = "physio.patientMode";

export function savePatientData(bundle: FamilyBundle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bundle));
    localStorage.setItem(MODE_KEY, "1");
  } catch { /* private mode */ }
}

export function getPatientData(): FamilyBundle | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FamilyBundle) : null;
  } catch {
    return null;
  }
}

export function isPatientMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "1" || localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function enterPatientMode(): void {
  try { localStorage.setItem(MODE_KEY, "1"); } catch { /* ignore */ }
}

// Forget the record and leave patient mode (back to the app chooser / admin setup).
export function clearPatientData(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(MODE_KEY);
  } catch { /* ignore */ }
}
