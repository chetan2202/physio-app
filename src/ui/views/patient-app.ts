// The patient app (R32): a read-only view of the family record a clinic shared as a QR.
// A device is in "patient mode" whenever a family bundle is stored locally. There is no
// clinic data here — the patient receives a snapshot and can refresh it from a newer QR.

import jsQR from "jsqr";
import type { FamilyBundle } from "../../patient/bundle.js";
import { decodeFamily } from "../../patient/bundle.js";
import { clearPatientData, getPatientData, savePatientData } from "../../patient/store.js";
import { el, icon } from "../dom.js";

// Mount the patient app into the given root. Returns nothing; re-renders in place.
export function mountPatientApp(root: HTMLElement): void {
  const render = () => {
    const data = getPatientData();
    root.replaceChildren(data ? familyView(root, data, render) : receiveScreen(render, true));
  };
  render();
}

// The first-run / "add code" screen: upload a saved QR image to receive the record.
function receiveScreen(render: () => void, first: boolean): HTMLElement {
  const status = el("div", { class: "hint", style: "margin-top:10px;min-height:18px" }, []);
  const fileInput = el("input", { type: "file", accept: "image/*" }) as HTMLInputElement;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    status.textContent = "Reading code…";
    try {
      const code = await codeFromImage(file);
      const bundle = await decodeFamily(code);
      savePatientData(bundle);
      render();
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Could not read that image.";
    } finally {
      fileInput.value = "";
    }
  });

  return el("div", { class: "center" }, [
    el("div", { class: "brandmark" }, [icon("users", 34)]),
    el("h2", {}, [first ? "Your physio record" : "Add a new code"]),
    el("p", { class: "hint" }, ["Your clinic gives you a QR code image. Save it to your phone, then open it here to see your visits and payments."]),
    el("div", { style: "margin-top:16px" }, [
      el("label", {}, ["QR code image"]),
      fileInput,
      status,
    ]),
    !first
      ? el("button", { class: "btn ghost", style: "margin-top:16px", onclick: () => render() }, ["Back"])
      : null,
  ]);
}

// The stored family record, read-only.
function familyView(root: HTMLElement, data: FamilyBundle, render: () => void): HTMLElement {
  const header = el("div", { class: "card", style: "padding:16px" }, [
    el("div", { style: "display:flex;align-items:center;gap:12px" }, [
      el("div", { class: "brandmark", style: "width:44px;height:44px" }, [icon("activity", 24)]),
      el("div", { class: "grow" }, [
        el("div", { class: "name", style: "font-size:17px" }, [data.clinic || "Your physio record"]),
        el("div", { class: "sub" }, [`Updated ${formatWhen(data.generatedAt)}`]),
      ]),
    ]),
  ]);

  const patients = data.patients.map((p) => patientCard(p.id, p.name, data));

  const actions = el("div", { style: "display:flex;gap:10px;margin-top:16px" }, [
    el("button", { class: "btn secondary", style: "flex:1", onclick: () => root.replaceChildren(receiveScreen(render, false)) }, [icon("plus"), "Update from clinic"]),
  ]);

  return el("div", { style: "padding:16px;max-width:520px;margin:0 auto" }, [
    header,
    ...patients,
    actions,
    el("button", { class: "btn ghost", style: "margin-top:16px", onclick() { if (confirm("Remove this record from this device?")) { clearPatientData(); location.reload(); } } }, ["Forget this record"]),
  ]);
}

function patientCard(patientId: string, name: string, data: FamilyBundle): HTMLElement {
  const visits = data.attendance.filter((a) => a.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const paidDates = new Set<string>();
  let totalPaid = 0;
  for (const pay of data.payments.filter((p) => p.patientId === patientId)) {
    totalPaid += pay.amount || 0;
    for (const d of pay.coveredDates) paidDates.add(d);
  }
  const due = visits.filter((v) => !paidDates.has(v.date));

  const rows = visits.slice(0, 12).map((v) => {
    const isPaid = paidDates.has(v.date);
    return el("div", { class: "sub", style: "display:flex;align-items:center;gap:8px;margin-top:6px" }, [
      el("span", { class: "grow" }, [formatDate(v.date)]),
      el("span", { class: "pill" + (isPaid ? " ok" : " due"), style: pillStyle(isPaid) }, [isPaid ? "Paid" : "Due"]),
    ]);
  });

  return el("div", { class: "card", style: "padding:16px;margin-top:12px" }, [
    el("div", { style: "display:flex;align-items:center;gap:10px" }, [
      el("div", { class: "avatar", style: "width:40px;height:40px;font-size:16px" }, [name.slice(0, 1).toUpperCase()]),
      el("div", { class: "grow" }, [
        el("div", { class: "name" }, [name]),
        el("div", { class: "sub" }, [`${visits.length} visit${visits.length === 1 ? "" : "s"} · ${due.length} due · ₹${totalPaid} paid`]),
      ]),
    ]),
    visits.length ? el("div", { style: "margin-top:10px" }, rows) : el("div", { class: "hint", style: "margin-top:10px" }, ["No visits recorded yet."]),
    visits.length > 12 ? el("div", { class: "hint", style: "margin-top:6px" }, [`+${visits.length - 12} earlier visits`]) : null,
  ]);
}

function pillStyle(ok: boolean): string {
  return `font-size:12px;padding:2px 10px;border-radius:999px;font-weight:600;${
    ok ? "background:var(--ok-bg,#e6f5ec);color:var(--ok,#137a3e)" : "background:var(--due-bg,#fdecec);color:var(--due,#c0392b)"
  }`;
}

// Decode a QR code from an uploaded image file using jsQR.
async function codeFromImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the image.");
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const found = jsQR(data, width, height);
  if (!found?.data) throw new Error("No QR code found in that image. Try a clearer photo or screenshot.");
  return found.data;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function formatWhen(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
