// Home: the patient list with a segment/filter bar (All / Today / Assigned to me /
// by Treatment) and name search, so the team can manage 60-100 patients (R10-R13).
// "Today" = patients with a visit marked today (seen today).

import type { AppController } from "../app.js";
import { canAddPatient } from "../../domain/types.js";
import type { Patient } from "../../domain/types.js";
import { el, icon, todayISO } from "../dom.js";
import { openPatientForm } from "./patient-form.js";

// Segment survives full re-renders (module singleton). `all` | `today` | `mine` | `treat:<name>`.
const state = { segment: "all", query: "" };

export function renderHome(app: AppController): HTMLElement {
  const snap = app.repo.get();
  const role = snap.currentMember?.role ?? "staff";
  const me = snap.currentMember;
  const seenToday = app.repo.patientIdsSeenOn(todayISO());
  const treatments = app.repo.treatments();

  // If a treatment segment was selected but that treatment no longer exists, fall back.
  if (state.segment.startsWith("treat:") && !treatments.includes(state.segment.slice(6))) {
    state.segment = "all";
  }

  const search = el("input", {
    type: "search",
    placeholder: "Search patients by name",
    value: state.query,
    oninput: (e: Event) => { state.query = (e.target as HTMLInputElement).value; renderList(); },
  }) as HTMLInputElement;

  const chipRow = el("div", { class: "chips-scroll" }, []);
  const buildChips = () => {
    const chips: { key: string; label: string }[] = [{ key: "all", label: "All" }, { key: "today", label: `Today (${seenToday.size})` }];
    if (me) chips.push({ key: "mine", label: "Assigned to me" });
    for (const t of treatments) chips.push({ key: `treat:${t}`, label: t });
    chipRow.replaceChildren(...chips.map((c) =>
      el("button", {
        class: "chip" + (state.segment === c.key ? " active" : ""),
        onclick: () => { state.segment = c.key; buildChips(); renderList(); },
      }, [c.label])));
  };

  const listWrap = el("div", {}, []);
  const renderList = () => {
    const q = state.query.trim().toLowerCase();
    const patients = [...snap.patients]
      .filter((p) => {
        if (state.segment === "today") return seenToday.has(p.id);
        if (state.segment === "mine") return me && p.assignedMemberId === me.id;
        if (state.segment.startsWith("treat:")) return (p.treatment?.trim() ?? "") === state.segment.slice(6);
        return true;
      })
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));

    listWrap.replaceChildren(
      el("div", { class: "section-title" }, [`Patients (${patients.length})`]),
      patients.length
        ? el("div", { class: "card list" }, patients.map((p) => patientRow(app, p, seenToday)))
        : el("div", { class: "empty" }, [
            icon("user", 40),
            el("div", {}, [emptyMessage()]),
            state.segment === "all" && !state.query && canAddPatient(role)
              ? el("div", { class: "hint" }, ["Add your first patient to begin."]) : null,
          ]),
    );
  };

  buildChips();
  renderList();

  const wrap = el("div", {}, [
    el("div", { class: "searchbar" }, [search]),
    chipRow,
    listWrap,
    el("div", { style: "height:72px" }),
  ]);

  if (canAddPatient(role)) {
    wrap.append(
      el("div", { class: "fab" }, [
        el("button", { class: "btn", onclick: () => openPatientForm(app) }, [icon("plus"), "Add patient"]),
      ]),
    );
  }
  return wrap;
}

function emptyMessage(): string {
  if (state.query) return "No patients match your search.";
  if (state.segment === "today") return "No patients seen today yet.";
  if (state.segment === "mine") return "No patients assigned to you.";
  if (state.segment.startsWith("treat:")) return "No patients in this treatment.";
  return "No patients yet.";
}

function patientRow(app: AppController, p: Patient, seenToday: Set<string>): HTMLElement {
  const paid = app.repo.paidDatesFor(p.id);
  const visits = app.repo.attendanceFor(p.id);
  const total = visits.length;
  const dueCount = visits.filter((v) => !paid.has(v.date)).length;
  const sub = [p.treatment?.trim(), seenToday.has(p.id) ? "seen today" : null].filter(Boolean).join(" · ");
  return el("button", { class: "row", onclick: () => app.navigate({ name: "patient", id: p.id }) }, [
    el("div", { class: "avatar" }, [p.name.slice(0, 1).toUpperCase()]),
    el("div", { class: "grow" }, [
      el("div", { class: "name" }, [p.name]),
      el("div", { class: "sub" }, [sub || p.phone || "—"]),
    ]),
    // Due visits over total visits, e.g. "2/10". Red when any are due (unpaid).
    el("div", { class: "count" + (dueCount > 0 ? " due" : "") }, [
      el("span", { class: "count-value" }, [`${dueCount}/${total}`]),
      el("span", { class: "count-label" }, [dueCount > 0 ? "due" : "visits"]),
    ]),
  ]);
}
