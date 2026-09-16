// App-side accessor for the closed Drive sync module. `@sync-module` resolves (via a Vite
// alias) to the vendored physio-sync module when present, or to the local-only stub. The
// client id comes from the admin's activation code (R30.1), so sync stays locked until the
// developer hands over a code. A dev fallback (VITE_GOOGLE_CLIENT_ID) is for local testing.

import type { SyncPort } from "./port.js";
import { getActivation } from "./activation.js";
import { createDriveSyncPort } from "@sync-module";

export interface DrivePort extends SyncPort {
  signIn(): Promise<string>; // admin interactive sign-in; returns the shareable 1-hour token
  setAccessToken(token: string): void; // staff: use the admin's shared token
  getAccessToken(): string | undefined;
  isAuthed(): boolean;
}

function activeClientId(): string {
  return getActivation()?.clientId || ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "") || "";
}

// Is the closed sync module present in this build (regardless of activation)?
export function moduleAvailable(): boolean {
  return !!createDriveSyncPort("probe.apps.googleusercontent.com");
}

// Is cloud sync available AND activated on this device?
export function syncAvailable(): boolean {
  const id = activeClientId();
  return !!id && moduleAvailable();
}

// Create the Drive port for the activated client id, or null if not available.
export function getDrivePort(): DrivePort | null {
  const id = activeClientId();
  if (!id) return null;
  const port = createDriveSyncPort(id);
  return (port as DrivePort | null) ?? null;
}
