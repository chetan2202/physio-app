// App-side accessor for the closed Drive sync module. `@sync-module` resolves (via a Vite
// alias) to the vendored physio-sync module when present, or to the local-only stub otherwise.
// The public repo never contains the module's source.

import type { SyncPort } from "./port.js";
import { createDriveSyncPort } from "@sync-module";

// What the app needs from the Drive port: the SyncPort push/pull plus Drive auth.
export interface DrivePort extends SyncPort {
  signIn(): Promise<string>; // admin interactive sign-in; returns the shareable 1-hour token
  setAccessToken(token: string): void; // staff: use the admin's shared token
  getAccessToken(): string | undefined;
  isAuthed(): boolean;
}

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

// Whether cloud sync is available in this build (module vendored + client id configured).
export function syncAvailable(): boolean {
  return !!CLIENT_ID && !!createDriveSyncPort(CLIENT_ID);
}

// Create the Drive port, or null if sync is not available here.
export function getDrivePort(): DrivePort | null {
  if (!CLIENT_ID) return null;
  const port = createDriveSyncPort(CLIENT_ID);
  return (port as DrivePort | null) ?? null;
}
