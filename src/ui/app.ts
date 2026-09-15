// App shell & router. Holds the current route, renders the top bar and active view,
// and provides a bottom-sheet used by forms. No framework — plain DOM.

import type { Repository } from "../storage/repository.js";
import { canManageMembers } from "../domain/types.js";
import { ROLE_LABELS } from "../domain/types.js";
import { APP_VERSION } from "../version.js";
import { clear, el, icon } from "./dom.js";
import { renderSetup } from "./views/setup.js";
import { renderHome } from "./views/home.js";
import { renderPatient } from "./views/patient.js";
import { renderMembers } from "./views/members.js";

type Route = { name: "home" } | { name: "patient"; id: string } | { name: "members" };

export class AppController {
  private route: Route = { name: "home" };
  private sheet?: HTMLElement;

  constructor(private root: HTMLElement, public repo: Repository) {}

  mount(): void {
    this.render();
  }

  navigate(route: Route): void {
    this.route = route;
    this.render();
  }

  render(): void {
    const snap = this.repo.get();
    clear(this.root);

    if (!snap.facility) {
      this.root.append(renderSetup(this));
      return;
    }

    this.root.append(this.topbar());
    const main = el("main", {}, [this.activeView()]);
    this.root.append(main);
    this.root.append(el("footer", {}, [`Physio v${APP_VERSION} · works offline`]));
    if (this.sheet) this.root.append(this.sheet);
  }

  private activeView(): HTMLElement {
    switch (this.route.name) {
      case "home": return renderHome(this);
      case "patient": return renderPatient(this, this.route.id);
      case "members": return renderMembers(this);
    }
  }

  private topbar(): HTMLElement {
    const snap = this.repo.get();
    const role = snap.currentMember?.role ?? "staff";
    const atHome = this.route.name === "home";

    const left = atHome
      ? (snap.facility?.logoDataUrl
          ? el("img", { class: "logo", src: snap.facility.logoDataUrl, alt: "" })
          : el("span", { class: "iconbtn" }, [icon("building", 22)]))
      : el("button", { class: "iconbtn", "aria-label": "Back", onclick: () => this.navigate({ name: "home" }) }, [icon("chevronLeft", 24)]);

    const title = atHome ? (snap.facility?.name ?? "Physio") : this.routeTitle();

    const right: (Node | null)[] = [];
    if (atHome && canManageMembers(role)) {
      right.push(el("button", { class: "iconbtn", "aria-label": "Members", onclick: () => this.navigate({ name: "members" }) }, [icon("users", 22)]));
    }
    right.push(el("span", { class: "role" }, [ROLE_LABELS[role]]));

    return el("header", { class: "topbar" }, [left, el("h1", {}, [title]), ...right]);
  }

  private routeTitle(): string {
    if (this.route.name === "patient") {
      return this.repo.patientById(this.route.id)?.name ?? "Patient";
    }
    if (this.route.name === "members") return "Members & roles";
    return "Physio";
  }

  // --- Bottom sheet ----------------------------------------------------------

  openSheet(title: string, body: (Node | null)[]): void {
    const panel = el("div", {
      style: "background:var(--surface);border-radius:20px 20px 0 0;padding:16px;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;width:100%;max-height:88vh;overflow:auto",
      onclick: (e: Event) => e.stopPropagation(),
    }, [
      el("div", { style: "display:flex;align-items:center;margin-bottom:4px" }, [
        el("h2", { style: "font-size:18px;margin:0;flex:1" }, [title]),
        el("button", { class: "btn ghost", style: "width:auto", onclick: () => this.closeSheet() }, ["Close"]),
      ]),
      ...body,
    ]);
    this.sheet = el("div", {
      style: "position:fixed;inset:0;background:rgba(20,32,30,.4);display:flex;align-items:flex-end;z-index:40",
      onclick: () => this.closeSheet(),
    }, [panel]);
    this.render();
  }

  closeSheet(): void {
    this.sheet = undefined;
    this.render();
  }

  // --- Service-worker update prompt -----------------------------------------

  showUpdateAvailable(apply: () => void): void {
    const toast = el("div", { class: "toast" }, [
      el("span", {}, ["A new version is available."]),
      el("button", { onclick: apply }, ["Update"]),
    ]);
    document.body.append(toast);
  }
}
