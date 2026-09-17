// Patient detail: profile + a single month calendar carrying both attendance and payment
// per day (long-press or tap a day to edit both), plus a "no dues" action (R69-R71).

import QRCode from "qrcode";
import type { AppController } from "../app.js";
import type { Patient } from "../../domain/types.js";
import { canAddPatient, canMarkAttendance, canMarkFees, scheduleLabel } from "../../domain/types.js";
import { encodeFamily, type FamilyBundle } from "../../patient/bundle.js";
import { el, icon, todayISO } from "../dom.js";
import { openPatientForm } from "./patient-form.js";

// Displayed calendar month, per patient (survives re-renders; resets when the patient changes).
let cal: { patientId: string; year: number; month: number } | null = null;
function ensureCal(patientId: string): { patientId: string; year: number; month: number } {
  if (!cal || cal.patientId !== patientId) {
    const now = new Date();
    cal = { patientId, year: now.getFullYear(), month: now.getMonth() };
  }
  return cal;
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function renderPatient(app: AppController, patientId: string): HTMLElement {
  const p = app.repo.patientById(patientId);
  if (!p) return el("div", { class: "empty" }, ["Patient not found."]);

  const role = app.repo.get().currentMember?.role ?? "staff";
  const visits = app.repo.attendanceFor(patientId);
  const paid = app.repo.paidDatesFor(patientId);
  const dueVisits = visits.filter((v) => !paid.has(v.date));

  const assignedTo = app.repo.memberById(p.assignedMemberId);
  const profile = el("div", { class: "card", style: "padding:16px" }, [
    el("div", { style: "display:flex;align-items:center;gap:12px" }, [
      el("div", { class: "avatar", style: "width:48px;height:48px;font-size:18px" }, [p.name.slice(0, 1).toUpperCase()]),
      el("div", { class: "grow" }, [
        el("div", { class: "name", style: "font-size:17px" }, [p.name]),
        el("div", { class: "sub" }, [
          [p.gender, p.age ? `${p.age} yrs` : null].filter(Boolean).join(" · "),
        ]),
      ]),
      canAddPatient(role)
        ? el("button", { class: "btn ghost", style: "width:auto", onclick: () => openPatientForm(app, p) }, ["Edit"])
        : null,
    ]),
    app.repo.ailmentNameFor(p) ? el("div", { class: "sub", style: "margin-top:12px" }, [icon("activity", 15), app.repo.ailmentNameFor(p)!]) : null,
    p.ailmentNotes ? el("div", { class: "sub", style: "margin-top:6px;color:var(--muted)" }, [p.ailmentNotes]) : null,
    p.plan ? el("div", { style: "margin-top:10px" }, [
      el("div", { class: "sub", style: "font-weight:600" }, ["Plan: " + p.plan.title]),
      p.plan.pointers.length ? el("ul", { style: "margin:6px 0 0;padding-left:20px;color:var(--muted);font-size:13px" }, p.plan.pointers.map((pt) => el("li", {}, [pt]))) : null,
    ]) : null,
    assignedTo ? el("div", { class: "sub", style: "margin-top:6px" }, [icon("user", 15), `Assigned to ${assignedTo.name}`]) : null,
    el("div", { class: "sub", style: "margin-top:6px" }, [
      icon("calendar", 15),
      `${p.visitType === "home" ? "Home visit" : "In-clinic"} · ${scheduleLabel(p.schedule)}`,
    ]),
    el("div", { class: "sub", style: "margin-top:6px" }, [icon("phone", 15), p.phone || "—"]),
    p.address ? el("div", { class: "sub", style: "margin-top:6px" }, [icon("building", 15), p.address]) : null,
    familyRow(app, p),
  ]);

  const actions = el("div", { style: "display:flex;gap:10px;margin-top:16px" }, [
    canMarkFees(role) && dueVisits.length
      ? el("button", {
          class: "btn secondary", style: "flex:1",
          async onclick() { await app.repo.markAllDuePaid(patientId); app.render(); },
        }, [icon("wallet"), `No dues (${dueVisits.length})`])
      : null,
    canAddPatient(role)
      ? el("button", { class: "btn secondary", style: "flex:1", onclick: () => openFamilyShare(app, patientId) }, [icon("users"), "Share with patient"])
      : null,
  ]);

  return el("div", {}, [
    profile,
    actions,
    el("div", { class: "section-title" }, [`Attendance & payments (${visits.length} visits · ${dueVisits.length} due)`]),
    renderCalendar(app, patientId),
    legend(),
  ]);
}

// Other patients sharing this phone number (R61).
function familyRow(app: AppController, p: Patient): HTMLElement | null {
  const family = app.repo.familyOf(p);
  if (!family.length) return null;
  const links: Node[] = [];
  family.forEach((f, i) => {
    links.push(el("a", { href: "#", style: "color:var(--brand-dark)", onclick: (e: Event) => { e.preventDefault(); app.navigate({ name: "patient", id: f.id }); } }, [f.name]));
    if (i < family.length - 1) links.push(document.createTextNode(", "));
  });
  return el("div", { class: "sub", style: "margin-top:6px" }, [icon("users", 15), el("span", {}, ["Family: "]), ...links]);
}

function renderCalendar(app: AppController, patientId: string): HTMLElement {
  const c = ensureCal(patientId);
  const daysInMonth = new Date(c.year, c.month + 1, 0).getDate();
  const startWeekday = new Date(c.year, c.month, 1).getDay(); // 0 = Sun
  const paid = app.repo.paidDatesFor(patientId);
  const visitDates = new Set(app.repo.attendanceFor(patientId).map((v) => v.date));
  const today = todayISO();
  const now = new Date();
  const isCurrentMonth = c.year === now.getFullYear() && c.month === now.getMonth();
  const monthLabel = new Date(c.year, c.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const head = el("div", { class: "cal-head" }, [
    el("button", { class: "iconbtn", "aria-label": "Previous month", onclick() { step(app, -1); } }, [icon("chevronLeft", 22)]),
    el("div", { class: "cal-title" }, [monthLabel]),
    el("button", { class: "iconbtn", "aria-label": "Next month", disabled: isCurrentMonth, onclick() { if (!isCurrentMonth) step(app, 1); } }, [icon("chevronRight", 22)]),
  ]);

  const weekdays = el("div", { class: "cal-grid cal-weekdays" }, ["S", "M", "T", "W", "T", "F", "S"].map((d) => el("div", { class: "cal-weekday" }, [d])));

  const cells: Node[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(el("div", { class: "cal-cell blank" }, []));
  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(c.year, c.month, day);
    const hasVisit = visitDates.has(date);
    const isPaid = paid.has(date);
    const cls = "cal-day"
      + (hasVisit ? (isPaid ? " visit-paid" : " visit-due") : "")
      + (date === today ? " today" : "");
    const cell = el("button", { class: cls }, [String(day)]);
    attachDayEdit(cell, () => openDayEditor(app, patientId, date));
    cells.push(cell);
  }

  return el("div", { class: "card calendar" }, [head, weekdays, el("div", { class: "cal-grid" }, cells)]);
}

function step(app: AppController, delta: number): void {
  if (!cal) return;
  const d = new Date(cal.year, cal.month + delta, 1);
  cal.year = d.getFullYear();
  cal.month = d.getMonth();
  app.render();
}

// Open the day editor on tap or long-press (long-press suppresses the trailing click).
function attachDayEdit(cell: HTMLElement, onEdit: () => void): void {
  let longFired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  cell.addEventListener("pointerdown", () => { longFired = false; timer = setTimeout(() => { longFired = true; onEdit(); }, 450); });
  const cancel = () => { if (timer) clearTimeout(timer); };
  cell.addEventListener("pointerup", cancel);
  cell.addEventListener("pointerleave", cancel);
  cell.addEventListener("pointercancel", cancel);
  cell.addEventListener("contextmenu", (e: Event) => e.preventDefault());
  cell.addEventListener("click", () => { if (longFired) { longFired = false; return; } onEdit(); });
}

function legend(): HTMLElement {
  return el("div", { class: "cal-legend" }, [
    el("span", {}, [el("i", { class: "dot paid" }), "Paid visit"]),
    el("span", {}, [el("i", { class: "dot due" }), "Due visit"]),
    el("span", { class: "hint" }, ["Tap or long-press a day to edit"]),
  ]);
}

// Edit both attendance and payment for a single day (R69).
function openDayEditor(app: AppController, patientId: string, date: string): void {
  const role = app.repo.get().currentMember?.role ?? "staff";
  const present = app.repo.hasVisitOn(patientId, date);
  const isPaid = app.repo.paidDatesFor(patientId).has(date);

  const presentBtn = el("button", {
    class: "btn" + (present ? "" : " secondary"),
    disabled: !canMarkAttendance(role),
    async onclick() {
      if (present) await app.repo.removeAttendanceOn(patientId, date);
      else await app.repo.markAttendance(patientId, date, undefined);
      app.render();
      openDayEditor(app, patientId, date);
    },
  }, [icon("check"), present ? "Present" : "Not present"]);

  const paidBtn = el("button", {
    class: "btn" + (isPaid ? "" : " secondary"),
    disabled: !canMarkFees(role) || !present,
    async onclick() {
      await app.repo.setDayPaid(patientId, date, !isPaid);
      app.render();
      openDayEditor(app, patientId, date);
    },
  }, [icon("wallet"), isPaid ? "Paid" : "Unpaid"]);

  app.openSheet(formatDate(date), [
    el("label", {}, ["Attendance"]), presentBtn,
    el("label", {}, ["Payment"]), paidBtn,
    !present ? el("p", { class: "hint" }, ["Mark the patient present to record a payment for this day."]) : null,
  ]);
}

export function openMarkFees(app: AppController, patientId: string): void {
  const paid = app.repo.paidDatesFor(patientId);
  const visits = app.repo.attendanceFor(patientId);
  const dueDates = visits.filter((v) => !paid.has(v.date)).map((v) => v.date);
  const selected = new Set(dueDates); // all due days selected by default; user can unselect

  const amount = el("input", { type: "number", min: "0", placeholder: "Total amount collected" }) as HTMLInputElement;

  const grid = el("div", { class: "daygrid" }, []);
  const rebuild = () => {
    grid.replaceChildren(...dueDates.map((d) => {
      const b = el("button", {
        class: selected.has(d) ? "sel" : "",
        onclick() {
          if (selected.has(d)) selected.delete(d); else selected.add(d);
          b.className = selected.has(d) ? "sel" : "";
          count.textContent = `${selected.size} of ${dueDates.length} days selected`;
        },
      }, [shortDate(d)]);
      return b;
    }));
  };
  const count = el("div", { class: "hint" }, [`${selected.size} of ${dueDates.length} days selected`]);
  rebuild();

  const quick = el("div", { style: "display:flex;gap:8px;margin-top:8px" }, [
    el("button", { class: "btn ghost", style: "width:auto;padding:6px 10px", onclick() { dueDates.forEach((d) => selected.add(d)); rebuild(); count.textContent = `${selected.size} of ${dueDates.length} days selected`; } }, ["Select all"]),
    el("button", { class: "btn ghost", style: "width:auto;padding:6px 10px", onclick() { selected.clear(); rebuild(); count.textContent = `0 of ${dueDates.length} days selected`; } }, ["Clear"]),
  ]);

  const save = el("button", {
    class: "btn",
    async onclick() {
      if (selected.size === 0) return;
      (save as HTMLButtonElement).disabled = true;
      await app.repo.markFeesPaid(patientId, [...selected], Number(amount.value) || 0);
      app.closeSheet();
      app.render();
    },
  }, ["Mark selected as paid"]);

  app.openSheet("Mark fees paid", [
    el("p", { class: "hint" }, ["Select the visit days this payment covers. Unselect any days that are not paid yet."]),
    grid, count, quick,
    el("label", {}, ["Amount collected (optional)"]), amount,
    el("div", { style: "height:16px" }), save,
  ]);
}

// Admin: generate a QR carrying this patient's family record for the patient app (R32).
async function openFamilyShare(app: AppController, patientId: string): Promise<void> {
  const p = app.repo.patientById(patientId);
  const data = app.repo.familyDataFor(patientId);
  const bundle: FamilyBundle = { t: "physio-family", v: 1, generatedAt: Date.now(), clinic: app.repo.get().facility?.name, ...data };
  const code = await encodeFamily(bundle);
  const img = el("img", { class: "qr", alt: "Patient family code" }) as HTMLImageElement;
  let fits = true;
  try {
    img.src = await QRCode.toDataURL(code, { margin: 1, width: 300, errorCorrectionLevel: "L" });
  } catch { fits = false; }
  app.openSheet("Share with patient", fits
    ? [
        el("p", { class: "hint" }, [`The patient scans this in their app to receive ${p?.name ?? "the patient"}'s family record (${data.patients.length} profile(s)) — or saves it and opens it from their gallery.`]),
        img,
        el("button", { class: "btn secondary", onclick: () => downloadDataUrl(`physio-family-${todayISO()}.png`, img.src) }, [icon("wallet"), "Download image"]),
      ]
    : [
        el("p", { class: "hint" }, ["There's too much history to fit in one QR code yet (multi-part codes are coming). A patient with a shorter history will fit."]),
        el("button", { class: "btn", onclick: () => app.closeSheet() }, ["Close"]),
      ]);
}

function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}
