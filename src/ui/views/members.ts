// Members & roles (Admin only): list members, change their role, and generate a
// role-scoped invitation code + QR. Cross-device joining activates with Google Drive
// sync in v0.1; until then the code/QR are generated and shown for that rollout.

import QRCode from "qrcode";
import type { AppController } from "../app.js";
import { ROLE_LABELS } from "../../domain/types.js";
import type { Role } from "../../domain/types.js";
import { el, icon } from "../dom.js";

const ROLES: Role[] = ["admin", "hod", "staff"];

export function renderMembers(app: AppController): HTMLElement {
  const snap = app.repo.get();

  const memberList = el("div", { class: "card list" }, snap.members.map((m) => {
    const select = el("select", {
      onchange: async (e: Event) => {
        await app.repo.setMemberRole(m.id, (e.target as HTMLSelectElement).value as Role);
        app.render();
      },
    }, ROLES.map((r) => el("option", { value: r, selected: r === m.role }, [ROLE_LABELS[r]]))) as HTMLSelectElement;

    return el("div", { class: "row", style: "cursor:default" }, [
      el("div", { class: "avatar" }, [m.name.slice(0, 1).toUpperCase()]),
      el("div", { class: "grow" }, [
        el("div", { class: "name" }, [m.name, m.isCurrentUser ? el("span", { class: "badge", style: "margin-left:8px" }, ["you"]) : null]),
      ]),
      el("div", { style: "width:110px;flex:none" }, [select]),
    ]);
  }));

  const invites = snap.invites.length
    ? el("div", { class: "card list" }, snap.invites.map((inv) =>
        el("div", { class: "row", style: "cursor:default" }, [
          el("div", { class: "grow" }, [
            el("div", { class: "code", style: "text-align:left;font-size:16px" }, [inv.code]),
            el("div", { class: "sub" }, [`Joins as ${ROLE_LABELS[inv.role]}`]),
          ]),
          el("button", { class: "btn ghost", style: "width:auto", onclick: () => openQr(app, inv.code, inv.role) }, ["Show QR"]),
          el("button", { class: "btn ghost", style: "width:auto;color:var(--danger)", async onclick() { await app.repo.revokeInvite(inv.code); app.render(); } }, ["Revoke"]),
        ])))
    : el("div", { class: "empty" }, [icon("users", 40), el("div", {}, ["No invitation codes yet."])]);

  return el("div", {}, [
    el("div", { class: "section-title" }, ["Members"]),
    memberList,
    el("div", { class: "section-title" }, ["Invitation codes"]),
    invites,
    el("p", { class: "hint" }, ["Sharing data across devices activates with Google Drive sync in v0.1."]),
    el("div", { style: "display:flex;gap:10px;margin-top:12px" }, ROLES.map((r) =>
      el("button", { class: "btn secondary", async onclick() { await app.repo.createInvite(r); app.render(); } }, [`Invite ${ROLE_LABELS[r]}`]))),
  ]);
}

async function openQr(app: AppController, code: string, role: Role): Promise<void> {
  const img = el("img", { class: "qr", alt: `Invite QR for ${code}` }) as HTMLImageElement;
  const payload = JSON.stringify({ t: "physio-invite", code, role });
  try {
    img.src = await QRCode.toDataURL(payload, { margin: 1, width: 200 });
  } catch {
    /* ignore render failure */
  }
  app.openSheet("Invitation", [
    el("div", { class: "code" }, [code]),
    el("p", { class: "hint" }, [`Joins as ${ROLE_LABELS[role]}. Scan to join once v0.1 sync is available.`]),
    img,
  ]);
}
