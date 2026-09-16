// Patient detail: profile, mark attendance (any role), attendance history, and mark fees
// paid over a selectable set of visit days (Admin).

import type { AppController } from "../app.js";
import { canAddPatient, canMarkAttendance, canMarkFees } from "../../domain/types.js";
import { el, icon, todayISO } from "../dom.js";
import { openPatientForm } from "./patient-form.js";

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
    el("div", { class: "sub", style: "margin-top:6px" }, [icon("phone", 15), p.phone || "—"]),
    p.address ? el("div", { class: "sub", style: "margin-top:6px" }, [icon("building", 15), p.address]) : null,
  ]);

  const actions = el("div", { style: "display:flex;gap:10px;margin-top:16px" }, [
    canMarkAttendance(role)
      ? el("button", { class: "btn", onclick: () => openMarkAttendance(app, patientId) }, [icon("check"), "Mark visit"])
      : null,
    canMarkFees(role) && dueVisits.length
      ? el("button", { class: "btn secondary", onclick: () => openMarkFees(app, patientId) }, [icon("wallet"), "Mark fees"])
      : null,
  ]);

  const history = visits.length
    ? el("div", { class: "card list" }, visits.map((v) =>
        el("div", { class: "row", style: "cursor:default" }, [
          el("div", { class: "avatar", style: "background:var(--brand-tint)" }, [icon("calendar", 18)]),
          el("div", { class: "grow" }, [
            el("div", { class: "name" }, [formatDate(v.date)]),
            el("div", { class: "sub" }, [v.time ? `at ${v.time}` : "visit"]),
          ]),
          paid.has(v.date)
            ? el("span", { class: "badge" }, ["paid"])
            : el("span", { class: "badge due" }, ["due"]),
        ])))
    : el("div", { class: "empty" }, [icon("calendar", 40), el("div", {}, ["No visits recorded yet."])]);

  return el("div", {}, [
    profile,
    actions,
    el("div", { class: "section-title" }, [`Attendance (${visits.length} visits · ${dueVisits.length} due)`]),
    history,
  ]);
}

function openMarkAttendance(app: AppController, patientId: string): void {
  const date = el("input", { type: "date", value: todayISO() }) as HTMLInputElement;
  const time = el("input", { type: "time" }) as HTMLInputElement;
  const save = el("button", {
    class: "btn",
    async onclick() {
      if (!date.value) return;
      (save as HTMLButtonElement).disabled = true;
      await app.repo.markAttendance(patientId, date.value, time.value || undefined);
      app.closeSheet();
      app.render();
    },
  }, ["Save visit"]);

  app.openSheet("Mark visit", [
    el("label", {}, ["Date"]), date,
    el("label", {}, ["Time (optional)"]), time,
    el("div", { style: "height:16px" }), save,
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}
