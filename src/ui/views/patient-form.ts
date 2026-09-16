// Shared "Add patient" / "Edit patient" sheet. Captures the core fields plus the ailment
// picked from the master list (+ optional notes, R62) and assigned staff member. Phone is
// optional and never unique (R61).

import type { AppController } from "../app.js";
import type { Gender, Patient } from "../../domain/types.js";
import { ROLE_LABELS } from "../../domain/types.js";
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

  const assign = el("select", {}, [
    el("option", { value: "", selected: !existing?.assignedMemberId }, ["Unassigned"]),
    ...snap.members.map((m) =>
      el("option", { value: m.id, selected: existing?.assignedMemberId === m.id }, [`${m.name} (${ROLE_LABELS[m.role]})`])),
  ]) as HTMLSelectElement;

  const address = el("textarea", { rows: "2", placeholder: "Address (optional)" }, [existing?.address ?? ""]) as HTMLTextAreaElement;

  const save = el("button", {
    class: "btn",
    async onclick() {
      const n = name.value.trim();
      if (!n) return;
      (save as HTMLButtonElement).disabled = true;
      const ailmentId = ailmentPicker.getValue() || undefined;
      const patch: Omit<Patient, "id" | "facilityId" | "createdAt"> = {
        name: n,
        age: age.value ? Number(age.value) : undefined,
        phone: phone.value.trim() || undefined,
        gender: gender.value as Gender,
        address: address.value.trim() || undefined,
        ailmentId,
        ailmentNotes: ailmentNotes.value.trim() || undefined,
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
    el("label", {}, ["Phone"]), phone,
    el("label", {}, ["Ailment"]), ailmentPicker.el,
    el("div", { class: "field-row", style: "align-items:flex-end;gap:8px;margin-top:8px" }, [
      el("div", {}, [newAilment]),
      addAilmentBtn,
    ]),
    ailmentNotes,
    el("label", {}, ["Assigned to"]), assign,
    el("label", {}, ["Address (optional)"]), address,
    el("div", { style: "height:16px" }), save,
  ]);
}

function input(type: string, placeholder: string, value?: string): HTMLInputElement {
  const node = el("input", { type, placeholder }) as HTMLInputElement;
  if (value) node.value = value;
  return node;
}
