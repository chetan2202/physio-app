// Cloud sync card (M10 wiring). Shown on the Members screen when the closed sync module is
// present. Admin signs into their own Google Drive, syncs, and shares a 1-hour access token
// with staff (QR). Staff paste/scan that token and sync. The Drive integration itself lives
// in the closed physio-sync module (pending a joint live-OAuth test).

import QRCode from "qrcode";
import type { AppController } from "../app.js";
import { getDrivePort, syncAvailable, type DrivePort } from "../../sync/drive.js";
import { syncNow } from "../../sync/port.js";
import { el, icon } from "../dom.js";

const SUPPORT_EMAIL = "info@vyakaranlabs.com";

// The Drive port holds the access token in memory; keep one instance across re-renders.
let port: DrivePort | null | undefined;
function drivePort(): DrivePort | null {
  if (port === undefined) port = getDrivePort();
  return port;
}

export function renderSyncCard(app: AppController): HTMLElement {
  if (!syncAvailable()) return notActivatedCard();

  const p = drivePort();
  if (!p) return notActivatedCard();

  if (!p.isAuthed()) {
    return card([
      cardHeader("cloud", "Cloud sync"),
      el("p", { class: "hint", style: "margin:0 0 12px" }, [
        "Sync this clinic's data through your own Google Drive. Sign in once; share a code with staff at checkout so they can sync the day's entries.",
      ]),
      el("button", {
        class: "btn",
        async onclick() {
          try { await p.signIn(); app.render(); }
          catch (e) { message(app, "Could not sign in", e); }
        },
      }, [icon("cloud"), "Sign in with Google"]),
    ]);
  }

  return card([
    cardHeader("cloud", "Cloud sync"),
    el("div", { class: "sub", style: "margin-bottom:12px;color:var(--brand-dark)" }, [icon("check", 15), "Connected to Google Drive"]),
    el("div", { style: "display:flex;gap:10px" }, [
      el("button", {
        class: "btn", style: "flex:1",
        async onclick() {
          try { const { applied } = await syncNow(app.repo, p); app.render(); message(app, "Sync complete", `Merged ${applied} change(s) from other devices.`); }
          catch (e) { message(app, "Sync failed", e); }
        },
      }, [icon("cloud"), "Sync now"]),
      el("button", { class: "btn secondary", style: "flex:1", onclick: () => shareStaffToken(app, p) }, [icon("users"), "Share with staff"]),
    ]),
  ]);
}

// Admin generates a QR carrying the current 1-hour access token for staff to scan.
async function shareStaffToken(app: AppController, p: DrivePort): Promise<void> {
  const token = p.getAccessToken();
  if (!token) { message(app, "Not connected", "Sign in to Google Drive first."); return; }
  const payload = JSON.stringify({ t: "physio-staff-token", token, at: Date.now() });
  const img = el("img", { class: "qr", alt: "Staff sync code" }) as HTMLImageElement;
  try { img.src = await QRCode.toDataURL(payload, { margin: 1, width: 220 }); } catch { /* ignore */ }
  app.openSheet("Share with staff", [
    el("p", { class: "hint" }, ["Staff scan this within the hour to sync today's data. It expires automatically; generate a new one anytime."]),
    img,
    el("button", { class: "btn", onclick: () => app.closeSheet() }, ["Done"]),
  ]);
}

// --- helpers ---------------------------------------------------------------

function card(children: (Node | null)[]): HTMLElement {
  return el("div", { class: "card", style: "padding:16px" }, children);
}
function cardHeader(ic: "cloud" | "mail", title: string): HTMLElement {
  return el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" }, [icon(ic, 22), el("div", { class: "name", style: "font-size:16px" }, [title])]);
}
function message(app: AppController, title: string, body: unknown): void {
  const text = body instanceof Error ? body.message : String(body);
  app.openSheet(title, [el("p", { class: "hint" }, [text]), el("button", { class: "btn", onclick: () => app.closeSheet() }, ["Close"])]);
}

// Local-only build (sync module not vendored): direct users to the developer to activate.
function notActivatedCard(): HTMLElement {
  return card([
    cardHeader("cloud", "Add staff & cloud sync"),
    el("p", { class: "hint", style: "margin:0 0 12px" }, [
      "This app currently runs on this device for the admin only. To add staff and use cloud sync of your data across devices, please contact the developer.",
    ]),
    el("a", { class: "btn", href: `mailto:${SUPPORT_EMAIL}?subject=Physio%20app%20-%20add%20staff%20%26%20cloud%20sync`, style: "text-decoration:none" }, [icon("mail"), SUPPORT_EMAIL]),
  ]);
}
