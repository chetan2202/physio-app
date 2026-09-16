// Treatment-plan library (R64-R65). On first visit the admin makes the one-time seed
// choice (adopt starter plans or start empty); thereafter it is their independent library
// (add / edit / delete). Plans are title + pointers.

import type { AppController } from "../app.js";
import type { PlanTemplate } from "../../domain/types.js";
import { SEED_PLANS } from "../../domain/seed-plans.js";
import { el, icon } from "../dom.js";

export function renderPlans(app: AppController): HTMLElement {
  // First-run: the one-time seed choice.
  if (!app.repo.plansAdopted()) {
    return el("div", { class: "center" }, [
      el("div", { class: "brandmark" }, [icon("activity", 34)]),
      el("h2", {}, ["Treatment plans"]),
      el("p", { class: "hint" }, [
        `Start with ${SEED_PLANS.length} ready-made physiotherapy plans you can edit and add to, `,
        "or start with a blank library. You can change everything later.",
      ]),
      el("div", { style: "margin-top:16px" }, [
        el("button", { class: "btn", async onclick() { await app.repo.adoptSeedPlans(true); app.render(); } }, ["Add starter plans"]),
        el("div", { style: "height:10px" }),
        el("button", { class: "btn ghost", async onclick() { await app.repo.adoptSeedPlans(false); app.render(); } }, ["Start with a blank library"]),
      ]),
    ]);
  }

  const plans = app.repo.plans();
  const list = plans.length
    ? el("div", { class: "card list" }, plans.map((p) =>
        el("button", { class: "row", onclick: () => openPlanForm(app, p) }, [
          el("div", { class: "avatar", style: "background:var(--brand-tint)" }, [icon("activity", 18)]),
          el("div", { class: "grow" }, [
            el("div", { class: "name" }, [p.title]),
            el("div", { class: "sub" }, [p.pointers.length ? p.pointers.join(" · ") : "No steps"]),
          ]),
        ])))
    : el("div", { class: "empty" }, [icon("activity", 40), el("div", {}, ["No plans yet."])]);

  return el("div", {}, [
    el("div", { class: "section-title" }, [`Treatment plans (${plans.length})`]),
    list,
    el("div", { style: "height:72px" }),
    el("div", { class: "fab" }, [
      el("button", { class: "btn", onclick: () => openPlanForm(app) }, [icon("plus"), "Add plan"]),
    ]),
  ]);
}

function openPlanForm(app: AppController, existing?: PlanTemplate): void {
  const title = el("input", { type: "text", placeholder: "Plan title, e.g. Low back pain" }) as HTMLInputElement;
  if (existing) title.value = existing.title;
  const pointers = el("textarea", { rows: "6", placeholder: "One step per line\ne.g.\nHeat pad\nIsometric quads\nIcing" }, [existing ? existing.pointers.join("\n") : ""]) as HTMLTextAreaElement;

  const save = el("button", {
    class: "btn",
    async onclick() {
      const t = title.value.trim();
      if (!t) return;
      (save as HTMLButtonElement).disabled = true;
      const pts = pointers.value.split("\n").map((s) => s.trim()).filter(Boolean);
      if (existing) await app.repo.updatePlan(existing.id, { title: t, pointers: pts });
      else await app.repo.addPlan(t, pts);
      app.closeSheet();
      app.render();
    },
  }, [existing ? "Save changes" : "Add plan"]);

  const body: (Node | null)[] = [
    el("label", {}, ["Title"]), title,
    el("label", {}, ["Steps / pointers"]), pointers,
    el("div", { style: "height:16px" }), save,
  ];
  if (existing) {
    body.push(el("button", {
      class: "btn ghost", style: "color:var(--danger);margin-top:8px",
      async onclick() { await app.repo.deletePlan(existing.id); app.closeSheet(); app.render(); },
    }, ["Delete plan"]));
  }

  app.openSheet(existing ? "Edit plan" : "Add plan", body);
}
