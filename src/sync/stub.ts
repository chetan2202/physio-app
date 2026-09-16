// Local-only stub for the sync module alias. When the closed sync module is not vendored
// in (public build / not activated), this is what `#sync-module` resolves to, so the app
// builds and runs local-only. Returning null means "cloud sync is not available here."

export function createDriveSyncPort(_clientId: string): unknown {
  return null;
}
