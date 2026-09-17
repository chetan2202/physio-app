// App-side accessor for the Drive sync port. The module is public/committed now, so it is
// always in the build; cloud sync is gated purely by the admin's activation code (R30.1)
// which carries the OAuth client id. A dev fallback (VITE_GOOGLE_CLIENT_ID) is for local testing.

import type { SyncPort } from "./port.js";
import { DriveSyncPort } from "./drive-sync-port.js";
import { getActivation } from "./activation.js";

export interface DrivePort extends SyncPort {
  signIn(): Promise<string>; // admin interactive sign-in; returns the shareable 1-hour token
  setAccessToken(token: string): void; // staff: use the admin's shared token
  getAccessToken(): string | undefined;
  isAuthed(): boolean;
}

function activeClientId(): string {
  return getActivation()?.clientId || ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "") || "";
}

// Is cloud sync activated on this device (an activation code entered, or a dev client id)?
export function syncAvailable(): boolean {
  return !!activeClientId();
}

// Create the Drive port for the activated client id + folder, or null if not activated.
export function getDrivePort(): DrivePort | null {
  const id = activeClientId();
  if (!id) return null;
  return new DriveSyncPort(id, getActivation()?.folderName);
}

// Build a Drive port from explicit coordinates (staff device: from the scanned token QR /
// stored staff session, not from a PHY activation).
export function drivePortFor(clientId: string, folderName?: string): DrivePort {
  return new DriveSyncPort(clientId, folderName);
}
