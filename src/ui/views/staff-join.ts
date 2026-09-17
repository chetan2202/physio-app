// Staff join & re-sync (R33). A staff member joins a clinic on their own device by scanning the
// admin's "Share with staff" QR (a 1-hour Drive token + the clinic's Drive coordinates). The same
// scan, once joined, syncs the day's entries. Reuses the QR-image decode (no camera).

import type { AppController } from "../app.js";
import { drivePortFor } from "../../sync/drive.js";
import { syncNow, deviceId } from "../../sync/port.js";
import { parseStaffToken, setStaffSession, type StaffTokenPayload } from "../../sync/staff-session.js";
import { codeFromImage } from "../qr-scan.js";
import { el } from "../dom.js";

// Open a sheet to upload the clinic-code image; on a valid token, run `onToken`.
function scanForToken(app: AppController, title: string, hint: string, onToken: (p: StaffTokenPayload) => Promise<void>): void {
  const status = el("div", { class: "hint", style: "margin-top:10px;min-height:18px" }, []);
  const fileInput = el("input", { type: "file", accept: "image/*" }) as HTMLInputElement;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    status.textContent = "Reading code…";
    try {
      const payload = parseStaffToken(await codeFromImage(file));
      await onToken(payload);
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Could not read that code.";
    } finally {
      fileInput.value = "";
    }
  });

  app.openSheet(title, [
    el("p", { class: "hint" }, [hint]),
    el("label", {}, ["Clinic code image"]),
    fileInput,
    status,
  ]);
}

// From the setup screen: join a clinic as staff on a fresh device.
export function openStaffJoin(app: AppController): void {
  scanForToken(app, "Join as staff", "Your admin shows a clinic code at sign-up. Save it to your phone, then open it here.", async (payload) => {
    const port = drivePortFor(payload.clientId, payload.folderName);
    port.setAccessToken(payload.token);
    const peers = await port.pull(deviceId());
    if (!peers.length) throw new Error("No clinic data found for that code. Ask your admin to tap Sync first, then share a fresh code.");
    askName(app, payload.clinic, async (name) => {
      await app.repo.joinAsStaff(name, peers);
      setStaffSession({ clientId: payload.clientId, folderName: payload.folderName, clinic: payload.clinic });
      app.closeSheet();
      app.navigate({ name: "home" });
    });
  });
}

// From the staff sync card: sync the day's entries with a fresh code.
export function openStaffSync(app: AppController): void {
  scanForToken(app, "Sync with clinic", "Scan the code your admin shows at checkout. It works for one hour.", async (payload) => {
    const port = drivePortFor(payload.clientId, payload.folderName);
    port.setAccessToken(payload.token);
    const { applied } = await syncNow(app.repo, port);
    setStaffSession({ clientId: payload.clientId, folderName: payload.folderName, clinic: payload.clinic });
    app.openSheet("Sync complete", [
      el("p", { class: "hint" }, [`Merged ${applied} change(s) from the clinic.`]),
      el("button", { class: "btn", onclick: () => { app.closeSheet(); app.render(); } }, ["Done"]),
    ]);
  });
}

// Ask the joining staff member for their name before creating their member record.
function askName(app: AppController, clinic: string | undefined, onName: (name: string) => Promise<void>): void {
  const input = el("input", { type: "text", placeholder: "Your name" }) as HTMLInputElement;
  const cont = el("button", {
    class: "btn",
    async onclick() {
      const name = input.value.trim();
      if (!name) return;
      (cont as HTMLButtonElement).disabled = true;
      try { await onName(name); }
      catch (e) { (cont as HTMLButtonElement).disabled = false; input.insertAdjacentElement("afterend", el("div", { class: "hint", style: "color:var(--danger)" }, [e instanceof Error ? e.message : "Could not join."])); }
    },
  }, ["Join clinic"]) as HTMLButtonElement;
  app.openSheet(clinic ? `Join ${clinic}` : "Join clinic", [
    el("p", { class: "hint" }, ["Enter your name so the clinic knows who marked each entry."]),
    el("label", {}, ["Your name"]),
    input,
    el("div", { style: "height:12px" }),
    cont,
  ]);
}
