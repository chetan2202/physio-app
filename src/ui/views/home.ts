// Home: patient list with a collapsible, multi-select filter panel + name search, so the
// team can manage 60-100+ patients (R72-R73). Filters combine as OR within a dimension and
// AND across dimensions. The panel hides for full-screen browsing; the filter icon reopens it.

import type { AppController } from "../app.js";
import { canAddPatient, isScheduledOn } from "../../domain/types.js";
import type { Patient } from "../../domain/types.js";
import { el, icon, todayISO } from "../dom.js";
import { openPatientForm } from "./patient-form.js";
import { openMarkFees } from "./patient.js";

// Filter + search state (module singleton; survives re-renders).
const state = {
  query: "",
  panelOpen: false,
  ailments: new Set<string>(), // ailment display names (OR)
  visits: new Set<string>(),   // "clinic" | "home" (OR)
  assignedToMe: false,
  seenToday: false,
  scheduledToday: false,
  hasDues: false,
};

function activeCount(): number {
  return state.ailments.size + state.visits.size
    + (state.assignedToMe ? 1 : 0) + (state.seenToday ? 1 : 0)
    + (state.scheduledToday ? 1 : 0) + (state.hasDues ? 1 : 0);
}
function clearFilters(): void {
  state.ailments.clear(); state.visits.clear();
  state.assignedToMe = state.seenToday = state.scheduledToday = state.hasDues = false;
}
function toggleSet(set: Set<string>, v: string): void {
  if (set.has(v)) set.delete(v); else set.add(v);
}

export function renderHome(app: AppController): HTMLElement {
  const snap = app.repo.get();
  const role = snap.currentMember?.role ?? "staff";
  const me = snap.currentMember;
  const today = todayISO();
  const seenTodaySet = app.repo.patientIdsSeenOn(today);
  const ailmentsInUse = app.repo.ailmentsInUse();

  // Drop ailment filters that no longer apply.
  for (const a of [...state.ailments]) if (!ailmentsInUse.includes(a)) state.ailments.delete(a);

  const dueCountFor = (p: Patient): number => {
    const paid = app.repo.paidDatesFor(p.id);
    return app.repo.attendanceFor(p.id).filter((v) => !paid.has(v.date)).length;
  };

  const search = el("input", {
    type: "search", placeholder: "Search patients by name", value: state.query,
    oninput: (e: Event) => { state.query = (e.target as HTMLInputElement).value; renderList(); },
  }) as HTMLInputElement;

  const filterBtn = el("button", { class: "filter-btn", "aria-label": "Filters", onclick: () => { state.panelOpen = !state.panelOpen; refresh(); } }, []);
  const summary = el("div", { class: "filter-summary" }, []);
  const panel = el("div", { class: "filter-panel" }, []);
  const listWrap = el("div", {}, []);

  const chip = (label: string, active: boolean, onclick: () => void): HTMLElement =>
    el("button", { type: "button", class: "chip" + (active ? " active" : ""), onclick }, [label]);
  const section = (label: string, chips: (Node | null)[]): HTMLElement =>
    el("div", { class: "filter-section" }, [el("div", { class: "filter-label" }, [label]), el("div", { class: "chips-wrap" }, chips)]);

  const buildFilterBtn = () => {
    const n = activeCount();
    filterBtn.className = "filter-btn" + (n || state.panelOpen ? " active" : "");
    filterBtn.replaceChildren(icon("filter", 20), ...(n ? [el("span", { class: "badge-count" }, [String(n)])] : []));
  };

  const buildSummary = () => {
    const n = activeCount();
    summary.hidden = state.panelOpen || n === 0;
    if (summary.hidden) return;
    summary.replaceChildren(
      el("span", {}, [`${n} filter${n > 1 ? "s" : ""} active`]),
      el("button", { class: "btn ghost", style: "width:auto;padding:2px 8px", onclick: () => { clearFilters(); refresh(); } }, ["Clear"]),
    );
  };

  const buildPanel = () => {
    panel.hidden = !state.panelOpen;
    if (panel.hidden) return;
    const parts: Node[] = [
      section("Quick", [
        me ? chip("Assigned to me", state.assignedToMe, () => { state.assignedToMe = !state.assignedToMe; refresh(); }) : null,
        chip("Seen today", state.seenToday, () => { state.seenToday = !state.seenToday; refresh(); }),
        chip("Scheduled today", state.scheduledToday, () => { state.scheduledToday = !state.scheduledToday; refresh(); }),
        chip("Has dues", state.hasDues, () => { state.hasDues = !state.hasDues; refresh(); }),
      ]),
      section("Visit type", [
        chip("In-clinic", state.visits.has("clinic"), () => { toggleSet(state.visits, "clinic"); refresh(); }),
        chip("Home visit", state.visits.has("home"), () => { toggleSet(state.visits, "home"); refresh(); }),
      ]),
    ];
    if (ailmentsInUse.length) parts.push(section("Ailment", ailmentsInUse.map((a) => chip(a, state.ailments.has(a), () => { toggleSet(state.ailments, a); refresh(); }))));
    if (activeCount()) parts.push(el("button", { class: "btn ghost", style: "margin-top:4px", onclick: () => { clearFilters(); refresh(); } }, ["Clear all filters"]));
    panel.replaceChildren(...parts);
  };

  const renderList = () => {
    const q = state.query.trim().toLowerCase();
    const patients = snap.patients.filter((p) => {
      if (state.assignedToMe && !(me && p.assignedMemberId === me.id)) return false;
      if (state.seenToday && !seenTodaySet.has(p.id)) return false;
      if (state.scheduledToday && !isScheduledOn(p.schedule, today)) return false;
      if (state.hasDues && dueCountFor(p) === 0) return false;
      if (state.ailments.size && !state.ailments.has(app.repo.ailmentNameFor(p) ?? "")) return false;
      if (state.visits.size && !state.visits.has(p.visitType ?? "clinic")) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    listWrap.replaceChildren(
      el("div", { class: "section-title" }, [`Patients (${patients.length})`]),
      patients.length
        ? el("div", { class: "card list" }, patients.map((p) => patientRow(app, p, seenTodaySet)))
        : el("div", { class: "empty" }, [
            icon("user", 40),
            el("div", {}, [activeCount() || state.query ? "No patients match your filters." : "No patients yet."]),
            !activeCount() && !state.query && canAddPatient(role) ? el("div", { class: "hint" }, ["Add your first patient to begin."]) : null,
          ]),
    );
  };

  const refresh = () => { buildFilterBtn(); buildSummary(); buildPanel(); renderList(); };
  refresh();

  const wrap = el("div", {}, [
    el("div", { class: "filter-row" }, [search, filterBtn]),
    summary,
    panel,
    listWrap,
    el("div", { style: "height:72px" }),
  ]);

  if (canAddPatient(role)) {
    wrap.append(el("div", { class: "fab" }, [
      el("button", { class: "btn", onclick: () => openPatientForm(app) }, [icon("plus"), "Add patient"]),
    ]));
  }
  return wrap;
}

function patientRow(app: AppController, p: Patient, seenToday: Set<string>): HTMLElement {
  const paid = app.repo.paidDatesFor(p.id);
  const visits = app.repo.attendanceFor(p.id);
  const total = visits.length;
  const dueCount = visits.filter((v) => !paid.has(v.date)).length;
  const present = seenToday.has(p.id);
  const canAct = app.repo.get().currentMember?.role === "admin"; // fees; staff can also mark present
  const sub = [app.repo.ailmentNameFor(p), p.plan?.title].filter(Boolean).join(" · ");

  // Two right-side quick actions (R68): mark present today, mark paid.
  const presentBtn = el("button", {
    class: "row-act" + (present ? " done" : ""),
    "aria-label": present ? "Present today" : "Mark present today",
    async onclick(e: Event) {
      e.stopPropagation();
      if (present) return; // already marked; edit via the calendar
      await app.repo.markAttendance(p.id, todayISO(), undefined);
      app.render();
    },
  }, [icon("check", 18)]);

  const paidBtn = el("button", {
    class: "row-act" + (dueCount > 0 ? " alert" : ""),
    "aria-label": "Mark paid",
    onclick(e: Event) { e.stopPropagation(); openMarkFees(app, p.id); },
  }, [icon("wallet", 18)]);

  return el("div", { class: "row" }, [
    el("button", { class: "row-main", onclick: () => app.navigate({ name: "patient", id: p.id }) }, [
      el("div", { class: "avatar" }, [p.name.slice(0, 1).toUpperCase()]),
      el("div", { class: "grow" }, [
        el("div", { class: "name" }, [p.name]),
        el("div", { class: "sub" }, [sub || p.phone || "—"]),
      ]),
      el("div", { class: "count" + (dueCount > 0 ? " due" : "") }, [
        el("span", { class: "count-value" }, [`${dueCount}/${total}`]),
        el("span", { class: "count-label" }, [dueCount > 0 ? "due" : "visits"]),
      ]),
    ]),
    presentBtn,
    canAct ? paidBtn : null,
  ]);
}
