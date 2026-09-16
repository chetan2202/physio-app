// Shared "Add patient" / "Edit patient" sheet. Captures the core fields plus the ailment
// picked from the master list (+ optional notes, R62) and assigned staff member. Phone is
// optional and never unique (R61).

import type { AppController } from "../app.js";
import type { Gender, Patient, Schedule, ScheduleKind, VisitType } from "../../domain/types.js";
import { ROLE_LABELS, WEEKDAYS } from "../../domain/types.js";
import { el } from "../dom.js";
import { searchablePicker, type PickerItem } from "../searchable-picker.js";

export function openPatientForm(app: AppController, existing?: Patient): void {
  const isEdit = !!existing;
  const snap = app.repo.get();

  const name = input("text", "Full name", existing?.name);
  const age = input("number", "Age", existing?.age != null ? String(existing.age) : "");
  (age as HTMLInputElement).min = "0";
  const phone = input("tel", "Phone number (optional)", existing?.phone);

  const gender = el("select", {}, (["male", "female", "other"] as Gender[]).map((g) =>
    el("option", { value: g, selected: existing?.gender === g }, [g[0]!.toUpperCase() + g.slice(1)]))) as HTMLSelectElement;

  // Ailment: searchable, category-filterable single-select from the master list (R62.1).
  const ailmentItems = (): PickerItem[] =>
    app.repo.ailments().map((a) => ({ id: a.id, name: a.name, category: a.category }));
  const ailmentPicker = searchablePicker({
    items: ailmentItems(),
    selectedId: existing?.ailmentId,
    placeholder: "Search ailment…",
    noneLabel: "No ailment",
  });

  const newAilment = input("text", "Add a new ailment");
  const addAilmentBtn = el("button", {
    class: "btn secondary", style: "width:auto;white-space:nowrap",
    async onclick() {
      const nm = newAilment.value.trim();
      if (!nm) return;
      const a = await app.repo.addAilment(nm);
      newAilment.value = "";
      ailmentPicker.setItems(ailmentItems(), a.id);
    },
  }, ["Add"]);

  const ailmentNotes = el("textarea", { rows: "2", placeholder: "Notes on the ailment (optional)" }, [existing?.ailmentNotes ?? ""]) as HTMLTextAreaElement;

  // Treatment plan (optional): pick from the library to prefill, then customise the
  // snapshot stored on this patient (R64).
  const planTitle = input("text", "Plan title (optional)", existing?.plan?.title);
  const planPointers = el("textarea", { rows: "4", placeholder: "One step per line" }, [existing?.plan?.pointers.join("\n") ?? ""]) as HTMLTextAreaElement;
  const planLibrary = app.repo.plans();
  const planPicker = planLibrary.length
    ? searchablePicker({
        items: planLibrary.map((p) => ({ id: p.id, name: p.title })),
        placeholder: "Pick a plan from your library…",
        noneLabel: "Write a custom plan",
        onChange: (id) => {
          const t = app.repo.planById(id);
          if (t) { planTitle.value = t.title; planPointers.value = t.pointers.join("\n"); }
        },
      })
    : undefined;

  const assign = el("select", {}, [
    el("option", { value: "", selected: !existing?.assignedMemberId }, ["Unassigned"]),
    ...snap.members.map((m) =>
      el("option", { value: m.id, selected: existing?.assignedMemberId === m.id }, [`${m.name} (${ROLE_LABELS[m.role]})`])),
  ]) as HTMLSelectElement;

  const address = el("textarea", { rows: "2", placeholder: "Address" }, [existing?.address ?? ""]) as HTMLTextAreaElement;

  // Family hint (R61): entering an existing phone groups the patient into that family.
  const phoneHint = el("div", { class: "hint", style: "margin:4px 4px 0" }, []);
  const updatePhoneHint = () => {
    const others = app.repo.patientsWithPhone(phone.value, existing?.id);
    phoneHint.textContent = others.length
      ? `Also used by ${others.map((o) => o.name).join(", ")} — grouped as one family.`
      : "";
  };
  phone.addEventListener("input", updatePhoneHint);
  updatePhoneHint();

  // Visit type (R66): clinic or home. Home requires an address.
  let visitType: VisitType = existing?.visitType ?? "clinic";
  const addressNote = el("div", { class: "hint", style: "margin:4px 4px 0" }, []);
  const setAddressNote = () => { addressNote.textContent = visitType === "home" ? "Address is required for home visits." : ""; };
  const visitSeg = el("div", { class: "segmented" }, []);
  const buildVisit = () => {
    visitSeg.replaceChildren(...([["clinic", "In-clinic"], ["home", "Home visit"]] as const).map(([v, label]) =>
      el("button", { type: "button", class: "seg" + (visitType === v ? " active" : ""),
        onclick: () => { visitType = v; buildVisit(); setAddressNote(); } }, [label])));
  };
  buildVisit();
  setAddressNote();

  // Schedule (R67): one-time / daily / specific weekdays.
  let scheduleKind: ScheduleKind = existing?.schedule?.kind ?? "one-time";
  const weekdaysSel = new Set<number>(existing?.schedule?.weekdays ?? []);
  const kindSel = el("select", {}, ([["one-time", "One-time"], ["daily", "Daily"], ["weekly", "Specific days"]] as const).map(([v, l]) =>
    el("option", { value: v, selected: scheduleKind === v }, [l]))) as HTMLSelectElement;
  const weekdayRow = el("div", { class: "weekday-row" }, []);
  const buildWeekdays = () => {
    weekdayRow.replaceChildren(...WEEKDAYS.map((lbl, i) =>
      el("button", { type: "button", class: "wd" + (weekdaysSel.has(i) ? " active" : ""),
        onclick: () => { if (weekdaysSel.has(i)) weekdaysSel.delete(i); else weekdaysSel.add(i); buildWeekdays(); } }, [lbl[0]!])));
    weekdayRow.hidden = scheduleKind !== "weekly";
  };
  kindSel.addEventListener("change", () => { scheduleKind = kindSel.value as ScheduleKind; buildWeekdays(); });
  buildWeekdays();

  const save = el("button", {
    class: "btn",
    async onclick() {
      const n = name.value.trim();
      if (!n) return;
      if (visitType === "home" && !address.value.trim()) { addressNote.textContent = "Please enter an address for the home visit."; return; }
      (save as HTMLButtonElement).disabled = true;
      const ailmentId = ailmentPicker.getValue() || undefined;
      const planT = planTitle.value.trim();
      const planPts = planPointers.value.split("\n").map((s) => s.trim()).filter(Boolean);
      const plan = planT || planPts.length ? { title: planT || "Treatment plan", pointers: planPts } : undefined;
      const schedule: Schedule = scheduleKind === "weekly"
        ? { kind: "weekly", weekdays: [...weekdaysSel].sort((a, b) => a - b) }
        : { kind: scheduleKind };
      const patch: Omit<Patient, "id" | "facilityId" | "createdAt"> = {
        name: n,
        age: age.value ? Number(age.value) : undefined,
        phone: phone.value.trim() || undefined,
        gender: gender.value as Gender,
        address: address.value.trim() || undefined,
        visitType,
        schedule,
        ailmentId,
        ailmentNotes: ailmentNotes.value.trim() || undefined,
        plan,
        // Once an ailment is picked, drop the legacy free-text field.
        treatment: ailmentId ? undefined : existing?.treatment,
        assignedMemberId: assign.value || undefined,
      };
      if (existing) await app.repo.updatePatient(existing.id, patch);
      else await app.repo.addPatient(patch);
      app.closeSheet();
      app.render();
    },
  }, [isEdit ? "Save changes" : "Save patient"]);

  app.openSheet(isEdit ? "Edit patient" : "Add patient", [
    el("label", {}, ["Name"]), name,
    el("div", { class: "field-row" }, [
      el("div", {}, [el("label", {}, ["Age"]), age]),
      el("div", {}, [el("label", {}, ["Gender"]), gender]),
    ]),
    el("label", {}, ["Phone"]), phone, phoneHint,
    el("label", {}, ["Visit type"]), visitSeg,
    el("label", {}, ["Address"]), address, addressNote,
    el("label", {}, ["Schedule"]), kindSel, weekdayRow,
    el("label", {}, ["Ailment"]), ailmentPicker.el,
    el("div", { class: "field-row", style: "align-items:flex-end;gap:8px;margin-top:8px" }, [
      el("div", {}, [newAilment]),
      addAilmentBtn,
    ]),
    ailmentNotes,
    el("label", {}, ["Treatment plan (optional)"]),
    planPicker?.el ?? null,
    planTitle,
    planPointers,
    el("label", {}, ["Assigned to"]), assign,
    el("div", { style: "height:16px" }), save,
  ]);
}

function input(type: string, placeholder: string, value?: string): HTMLInputElement {
  const node = el("input", { type, placeholder }) as HTMLInputElement;
  if (value) node.value = value;
  return node;
}
