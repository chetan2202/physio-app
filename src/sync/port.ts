// Sync seam (M9). The public app ships this interface + a no-op LocalSyncPort; the closed
// physio-sync module provides a DriveSyncPort injected on activation. A "bundle" is this
// device's data snapshot (ExportBundle); each device publishes its own and pulls peers'.
// Merge is last-writer-wins / union in Repository.mergeBundle — commutative and idempotent,
// so this is safe for the daily-batched Drive backup model without a full operation log.

import type { ExportBundle, Repository } from "../storage/repository.js";

export interface SyncPort {
  // Publish this device's bundle to shared storage (keyed by deviceId).
  push(deviceId: string, bundle: ExportBundle): Promise<void>;
  // Pull every peer device's bundle (all except this device).
  pull(deviceId: string): Promise<ExportBundle[]>;
}

// Default port for the single-device / not-yet-activated app: keeps everything local.
export class LocalSyncPort implements SyncPort {
  async push(): Promise<void> { /* local-only: nothing to publish */ }
  async pull(): Promise<ExportBundle[]> { return []; }
}

// A stable per-device id, persisted in localStorage (best-effort).
export function deviceId(): string {
  try {
    let id = localStorage.getItem("physio.deviceId");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("physio.deviceId", id); }
    return id;
  } catch {
    return "device";
  }
}

// One sync round-trip: publish our bundle, pull peers', merge them in.
export async function syncNow(repo: Repository, port: SyncPort): Promise<{ applied: number }> {
  const id = deviceId();
  await port.push(id, repo.exportData());
  const peers = await port.pull(id);
  let applied = 0;
  for (const bundle of peers) applied += (await repo.mergeBundle(bundle)).applied;
  return { applied };
}
