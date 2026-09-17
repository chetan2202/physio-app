// DriveSyncPort — implements SyncPort over the admin's own Google Drive using the
// `drive.file` scope and the GIS token flow. Each device writes its own bundle file
// (`<deviceId>.json`) in a clinic folder; devices read peers' files. No developer server,
// no client secret. (Moved into the public repo 2026-09-17 to simplify deployment;
// contains no secrets — the client id comes from the admin's activation code.)
//
// Auth: admin `signIn()` (interactive, returns a ~1h token); staff `setAccessToken()` with
// the admin's shared token.

import type { GisTokenResponse } from "./gis.d.js";
import type { ExportBundle } from "../storage/repository.js";
import type { SyncPort } from "./port.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com";

interface DriveFile { id: string; name: string; }
interface DriveList { files?: DriveFile[]; }

export class DriveSyncPort implements SyncPort {
  private accessToken?: string;
  private folderId?: string;

  constructor(
    private readonly clientId: string,
    private readonly folderName = "PhysioApp",
  ) {}

  // --- Auth ------------------------------------------------------------------

  /** Admin interactive sign-in. Returns the access token (to share with staff via QR). */
  async signIn(): Promise<string> {
    await loadGis();
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) throw new Error("Google Identity Services failed to load.");
    const token = await new Promise<string>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: (resp: GisTokenResponse) => {
          if (resp.error || !resp.access_token) reject(new Error(resp.error ?? "No access token"));
          else resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(err.message ?? err.type ?? "Sign-in failed")),
      });
      client.requestAccessToken({ prompt: "" });
    });
    this.accessToken = token;
    return token;
  }

  /** Staff: use the admin's shared 1-hour token. */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  isAuthed(): boolean {
    return !!this.accessToken;
  }

  // --- SyncPort --------------------------------------------------------------

  async push(deviceId: string, bundle: ExportBundle): Promise<void> {
    const folderId = await this.ensureFolder();
    const name = `${deviceId}.json`;
    const content = JSON.stringify(bundle);
    const existing = await this.findFile(folderId, name);
    if (existing) await this.updateFileMedia(existing, content);
    else await this.createFileMultipart(name, folderId, content);
  }

  async pull(deviceId: string): Promise<ExportBundle[]> {
    const folderId = await this.ensureFolder();
    const q = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
    const list = await this.driveGet<DriveList>(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    const self = `${deviceId}.json`;
    const bundles: ExportBundle[] = [];
    for (const f of list.files ?? []) {
      if (f.name === self) continue; // skip our own file
      try {
        const text = await this.fetchText(`${API}/drive/v3/files/${f.id}?alt=media`);
        bundles.push(JSON.parse(text) as ExportBundle);
      } catch {
        // skip a corrupt/unreadable peer file rather than fail the whole sync
      }
    }
    return bundles;
  }

  // --- Drive helpers ---------------------------------------------------------

  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;
    this.folderId = (await this.findFolder()) ?? (await this.createFolder());
    return this.folderId;
  }

  private async findFolder(): Promise<string | undefined> {
    const q = `mimeType='${FOLDER_MIME}' and name='${this.folderName}' and trashed=false`;
    const res = await this.driveGet<DriveList>(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);
    return res.files?.[0]?.id;
  }

  private async createFolder(): Promise<string> {
    const res = await this.driveJson<DriveFile>("POST", "/drive/v3/files", { name: this.folderName, mimeType: FOLDER_MIME });
    return res.id;
  }

  private async findFile(folderId: string, name: string): Promise<string | undefined> {
    const q = `name='${name}' and '${folderId}' in parents and trashed=false`;
    const res = await this.driveGet<DriveList>(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    return res.files?.[0]?.id;
  }

  private async createFileMultipart(name: string, folderId: string, content: string): Promise<void> {
    const boundary = `physio-${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({ name, parents: [folderId] });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
      `--${boundary}--`;
    const r = await fetch(`${API}/upload/drive/v3/files?uploadType=multipart`, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!r.ok) throw new Error(`Drive create failed: ${r.status}`);
  }

  private async updateFileMedia(fileId: string, content: string): Promise<void> {
    const r = await fetch(`${API}/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: content,
    });
    if (!r.ok) throw new Error(`Drive update failed: ${r.status}`);
  }

  private authHeaders(): Record<string, string> {
    if (!this.accessToken) throw new Error("Not signed in to Google Drive.");
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  private async driveGet<T>(path: string): Promise<T> {
    const r = await fetch(`${API}${path}`, { headers: this.authHeaders() });
    if (!r.ok) throw new Error(`Drive GET ${path} failed: ${r.status}`);
    return r.json() as Promise<T>;
  }

  private async driveJson<T>(method: string, path: string, body: unknown): Promise<T> {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Drive ${method} ${path} failed: ${r.status}`);
    return r.json() as Promise<T>;
  }

  private async fetchText(url: string): Promise<string> {
    const r = await fetch(url, { headers: this.authHeaders() });
    if (!r.ok) throw new Error(`Drive read failed: ${r.status}`);
    return r.text();
  }
}

// Load the GIS client script once.
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(s);
  });
  return gisPromise;
}
