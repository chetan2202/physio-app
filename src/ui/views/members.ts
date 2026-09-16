// Members & roles (Admin only). In the current single-device build the app runs in
// admin-only mode: adding staff and syncing data across devices is enabled on request by
// the developer. The member list is read-only here; role management and multi-device
// arrive with cloud sync.

import type { AppController } from "../app.js";
import { ROLE_LABELS } from "../../domain/types.js";
import type { ExportBundle } from "../../storage/repository.js";
import { downloadText, el, icon, todayISO } from "../dom.js";

const SUPPORT_EMAIL = "info@vyakaranlabs.com";

export function renderMembers(app: AppController): HTMLElement {
  const snap = app.repo.get();

  const memberList = el("div", { class: "card list" }, snap.members.map((m) =>
    el("div", { class: "row", style: "cursor:default" }, [
      el("div", { class: "avatar" }, [m.name.slice(0, 1).toUpperCase()]),
      el("div", { class: "grow" }, [
        el("div", { class: "name" }, [m.name, m.isCurrentUser ? el("span", { class: "badge", style: "margin-left:8px" }, ["you"]) : null]),
        el("div", { class: "sub" }, [ROLE_LABELS[m.role]]),
      ]),
    ])));

  // Remark: adding staff and cloud sync are enabled on request by the developer.
  const contact = el("div", { class: "card", style: "padding:16px" }, [
    el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:8px" }, [
      icon("cloud", 22),
      el("div", { class: "name", style: "font-size:16px" }, ["Add staff & cloud sync"]),
    ]),
    el("p", { class: "hint", style: "margin:0 0 12px" }, [
      "This app currently runs on this device for the admin only. To add staff members and to use ",
      "cloud sync of your data across devices, please contact the developer.",
    ]),
    el("a", { class: "btn", href: `mailto:${SUPPORT_EMAIL}?subject=Physio%20app%20-%20add%20staff%20%26%20cloud%20sync`, style: "text-decoration:none" }, [
      icon("mail"), SUPPORT_EMAIL,
    ]),
  ]);

  return el("div", {}, [
    el("div", { class: "section-title" }, [`Members (${snap.members.length})`]),
    memberList,
    el("div", { class: "section-title" }, ["Team & sync"]),
    contact,
    el("div", { class: "section-title" }, ["Backup"]),
    backupCard(app),
  ]);
}

// Local backup/restore (R42): export all data to a JSON file, or restore/merge from one.
// Records upsert by id, so restore never wipes existing data.
function backupCard(app: AppController): HTMLElement {
  const fileInput = el("input", { type: "file", accept: "application/json,.json", style: "display:none" }) as HTMLInputElement;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const bundle = JSON.parse(String(reader.result)) as ExportBundle;
        const { records } = await app.repo.importData(bundle);
        fileInput.value = "";
        app.render();
        app.openSheet("Backup restored", [
          el("p", { class: "hint" }, [`Restored ${records} record(s) from the backup.`]),
          el("button", { class: "btn", onclick: () => app.closeSheet() }, ["Done"]),
        ]);
      } catch (err) {
        fileInput.value = "";
        app.openSheet("Could not restore", [
          el("p", { class: "hint" }, [err instanceof Error ? err.message : "The file could not be read as a Physio backup."]),
          el("button", { class: "btn", onclick: () => app.closeSheet() }, ["Close"]),
        ]);
      }
    };
    reader.readAsText(file);
  });

  return el("div", { class: "card", style: "padding:16px" }, [
    el("p", { class: "hint", style: "margin:0 0 12px" }, [
      "Your data is stored on this device only. Export a backup regularly, and keep the file safe — ",
      "you can restore it here or on a new device.",
    ]),
    el("div", { style: "display:flex;gap:10px" }, [
      el("button", {
        class: "btn secondary", style: "flex:1",
        onclick: () => {
          const json = JSON.stringify(app.repo.exportData(), null, 2);
          downloadText(`physio-backup-${todayISO()}.json`, json);
        },
      }, ["Export backup"]),
      el("button", { class: "btn secondary", style: "flex:1", onclick: () => fileInput.click() }, ["Restore"]),
    ]),
    fileInput,
  ]);
}
