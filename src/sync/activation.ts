// Maturity-token activation (R30.1). The developer hands an admin an activation code; the
// admin enters it to unlock cloud sync. The code carries the Drive OAuth config (client id,
// optional folder + label), base64url-encoded — so no config is baked into the build, and
// sync stays locked until a code is entered. Stored locally per device.
//
// Generate a code with: node scripts/make-activation.mjs <clientId> [folderName] [issuedTo]

const KEY = "physio.activation";

export interface Activation {
  clientId: string;
  code?: string; // the developer's per-clinic handout code (for tracking)
  folderName?: string;
  issuedTo?: string;
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
}

// Parse + store an activation code. Throws on an invalid code.
export function activate(code: string): Activation {
  let cfg: Activation;
  try {
    cfg = JSON.parse(b64urlDecode(code.trim())) as Activation;
  } catch {
    throw new Error("That activation code is not valid.");
  }
  if (!cfg || typeof cfg.clientId !== "string" || !cfg.clientId.includes(".apps.googleusercontent.com")) {
    throw new Error("That activation code is not valid.");
  }
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* private mode */ }
  return cfg;
}

export function getActivation(): Activation | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Activation) : null;
  } catch {
    return null;
  }
}

export function deactivate(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
