// Home: the patient list, with an "Add patient" action (Admin/HOD only).

import type { AppController } from "../app.js";
import { canAddPatient } from "../../domain/types.js";
import type { Gender, Patient } from "../../domain/types.js";
import { el, icon } from "../dom.js";

export function renderHome(app: AppController): HTMLElement {
  const snap = app.repo.get();
  const role = snap.currentMember?.role ?? "staff";
  const patients = [...snap.patients].sort((a, b) => a.name.localeCompare(b.name));

  const list = patients.length
    ? el("div", { class: "card list" }, patients.map((p) => patientRow(app, p)))
    : el("div", { class: "empty" }, [
        icon("user", 40),
        el("div", {}, ["No patients yet."]),
        canAddPatient(role) ? el("div", { class: "hint" }, ["Add your first patient to begin."]) : null,
      ]);

  const wrap = el("div", {}, [
    el("div", { class: "section-title" }, [`Patients (${patients.length})`]),
    list,
    el("div", { style: "height:72px" }),
  ]);

  if (canAddPatient(role)) {
    wrap.append(
      el("div", { class: "fab" }, [
        el("button", { class: "btn", onclick: () => openAddPatient(app) }, [icon("plus"), "Add patient"]),
      ]),
    );
  }
  return wrap;
}

function patientRow(app: AppController, p: Patient): HTMLElement {
  const paid = app.repo.paidDatesFor(p.id);
  const visits = app.repo.attendanceFor(p.id);
  const dueCount = visits.filter((v) => !paid.has(v.date)).length;
  return el("button", { class: "row", onclick: () => app.navigate({ name: "patient", id: p.id }) }, [
    el("div", { class: "avatar" }, [p.name.slice(0, 1).toUpperCase()]),
    el("div", { class: "grow" }, [
      el("div", { class: "name" }, [p.name]),
      el("div", { class: "sub" }, [icon("phone", 14), p.phone || "—"]),
    ]),
    dueCount > 0
      ? el("span", { class: "badge due" }, [`${dueCount} due`])
      : el("span", { class: "meta" }, [`${visits.length} visits`]),
  ]);
}

function openAddPatient(app: AppController): void {
  const name = el("input", { type: "text", placeholder: "Full name" }) as HTMLInputElement;
  const age = el("input", { type: "number", min: "0", placeholder: "Age" }) as HTMLInputElement;
  const phone = el("input", { type: "tel", placeholder: "Phone number" }) as HTMLInputElement;
  const gender = el("select", {}, [
    el("option", { value: "male" }, ["Male"]),
    el("option", { value: "female" }, ["Female"]),
    el("option", { value: "other" }, ["Other"]),
  ]) as HTMLSelectElement;
  const address = el("textarea", { rows: "2", placeholder: "Address (optional)" }) as HTMLTextAreaElement;

  const save = el("button", {
    class: "btn",
    async onclick() {
      const n = name.value.trim();
      const ph = phone.value.trim();
      if (!n || !ph) return;
      (save as HTMLButtonElement).disabled = true;
      const patient: Omit<Patient, "id" | "facilityId" | "createdAt"> = {
        name: n,
        age: age.value ? Number(age.value) : undefined,
        phone: ph,
        gender: gender.value as Gender,
        address: address.value.trim() || undefined,
      };
      await app.repo.addPatient(patient);
      app.closeSheet();
      app.render();
    },
  }, ["Save patient"]);

  app.openSheet("Add patient", [
    el("label", {}, ["Name"]), name,
    el("div", { class: "field-row" }, [
      el("div", {}, [el("label", {}, ["Age"]), age]),
      el("div", {}, [el("label", {}, ["Gender"]), gender]),
    ]),
    el("label", {}, ["Phone"]), phone,
    el("label", {}, ["Address (optional)"]), address,
    el("div", { style: "height:16px" }), save,
  ]);
}
