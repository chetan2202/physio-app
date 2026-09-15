// First-run screen: create a healthcare facility. The creator becomes the Admin.
// (Joining another facility via invite code needs cross-device sync, which is deferred
// to v0.1 with Google Drive; see README.)

import type { AppController } from "../app.js";
import { el, icon } from "../dom.js";

export function renderSetup(app: AppController): HTMLElement {
  let logoDataUrl: string | undefined;

  const facilityName = el("input", { type: "text", placeholder: "e.g. Active Life Physiotherapy" }) as HTMLInputElement;
  const adminName = el("input", { type: "text", placeholder: "Your name" }) as HTMLInputElement;
  const logoInput = el("input", { type: "file", accept: "image/*" }) as HTMLInputElement;

  logoInput.addEventListener("change", () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { logoDataUrl = String(reader.result); };
    reader.readAsDataURL(file);
  });

  const submit = el("button", {
    class: "btn",
    async onclick() {
      const name = facilityName.value.trim();
      const admin = adminName.value.trim();
      if (!name || !admin) return;
      (submit as HTMLButtonElement).disabled = true;
      await app.repo.createFacility(name, logoDataUrl, admin);
      app.navigate({ name: "home" });
    },
  }, ["Create facility"]) as HTMLButtonElement;

  return el("div", { class: "center" }, [
    el("div", { class: "brandmark" }, [icon("building", 32)]),
    el("h2", {}, ["Set up your center"]),
    el("p", { class: "hint" }, ["Create your physiotherapy center to start adding patients and marking attendance."]),
    el("div", { style: "margin-top:16px" }, [
      el("label", {}, ["Facility name"]),
      facilityName,
      el("label", {}, ["Your name (Admin)"]),
      adminName,
      el("label", {}, ["Logo (optional)"]),
      logoInput,
      el("div", { style: "height:20px" }),
      submit,
    ]),
  ]);
}
