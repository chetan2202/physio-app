// Shared "Add patient" / "Edit patient" sheet. Captures the core fields plus treatment
// (R8) and assigned staff member (R9). Phone is not required to be unique (R7).

import type { AppController } from "../app.js";
import type { Gender, Patient } from "../../domain/types.js";
import { ROLE_LABELS } from "../../domain/types.js";
import { el } from "../dom.js";

export function openPatientForm(app: AppController, existing?: Patient): void {
  const isEdit = !!existing;
  const snap = app.repo.get();

  const name = input("text", "Full name", existing?.name);
  const age = input("number", "Age", existing?.age != null ? String(existing.age) : "");
  (age as HTMLInputElement).min = "0";
  const phone = input("tel", "Phone number", existing?.phone);

  const gender = el("select", {}, (["male", "female", "other"] as Gender[]).map((g) =>
    el("option", { value: g, selected: existing?.gender === g }, [g[0]!.toUpperCase() + g.slice(1)]))) as HTMLSelectElement;

  // Treatment with a datalist of treatments already in use, for consistency.
  const treatListId = "treatments-list";
  const treatment = input("text", "e.g. Lower back, Post-op knee", existing?.treatment);
  treatment.setAttribute("list", treatListId);
  const datalist = el("datalist", { id: treatListId }, app.repo.treatments().map((t) => el("option", { value: t }))) as HTMLDataListElement;

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
      const ph = phone.value.trim();
      if (!n || !ph) return;
      (save as HTMLButtonElement).disabled = true;
      const patch: Omit<Patient, "id" | "facilityId" | "createdAt"> = {
        name: n,
        age: age.value ? Number(age.value) : undefined,
        phone: ph,
        gender: gender.value as Gender,
        address: address.value.trim() || undefined,
        treatment: treatment.value.trim() || undefined,
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
    el("label", {}, ["Treatment / condition"]), treatment, datalist,
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
