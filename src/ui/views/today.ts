// The "Today" board (R34): the day's tasks the admin assigns to the team. Staff see the tasks
// meant for them (or unassigned) and mark them done; everything syncs with the clinic.

import type { AppController } from "../app.js";
import type { DailyNote, DailyTask } from "../../domain/types.js";
import { canManageMembers } from "../../domain/types.js";
import { el, icon, todayISO } from "../dom.js";

export function renderToday(app: AppController): HTMLElement {
  const snap = app.repo.get();
  const role = snap.currentMember?.role ?? "staff";
  const me = snap.currentMember;
  const today = todayISO();
  // Admin sees the whole board; staff see tasks assigned to them or to nobody in particular.
  const tasks = app.repo.tasksFor(today, role === "admin" ? undefined : me?.id);
  const open = tasks.filter((t) => !t.doneAt);
  const done = tasks.filter((t) => t.doneAt);

  const list = el("div", {}, [
    el("div", { class: "section-title" }, [`Today's tasks (${open.length} open)`]),
    tasks.length
      ? el("div", { class: "card list" }, [...open, ...done].map((t) => taskRow(app, t)))
      : el("div", { class: "empty" }, [icon("check", 40), el("div", {}, ["No tasks for today."]), role === "admin" ? el("div", { class: "hint" }, ["Assign a task to your team below."]) : null]),
    notesSection(app, today),
    el("div", { style: "height:72px" }),
  ]);

  if (canManageMembers(role)) {
    list.append(el("div", { class: "fab" }, [
      el("button", { class: "btn", onclick: () => openTaskForm(app, today) }, [icon("plus"), "Assign task"]),
    ]));
  }
  return list;
}

function taskRow(app: AppController, t: DailyTask): HTMLElement {
  const snap = app.repo.get();
  const role = snap.currentMember?.role ?? "staff";
  const me = snap.currentMember;
  const assignee = app.repo.memberById(t.assignedMemberId);
  const patient = t.patientId ? app.repo.patientById(t.patientId) : undefined;
  const isDone = !!t.doneAt;
  // The assignee, an admin, or anyone (when unassigned) can complete it.
  const canToggle = role === "admin" || !t.assignedMemberId || t.assignedMemberId === me?.id;

  const check = el("button", {
    class: "row-act" + (isDone ? " done" : ""),
    "aria-label": isDone ? "Done" : "Mark done",
    disabled: !canToggle,
    async onclick() { if (canToggle) { await app.repo.setTaskDone(t.id, !isDone); app.render(); } },
  }, [icon("check", 18)]);

  const sub = [assignee ? assignee.name : "Anyone", patient?.name].filter(Boolean).join(" · ");

  return el("div", { class: "row" }, [
    el("div", { class: "row-main", style: "cursor:default" }, [
      check,
      el("div", { class: "grow" }, [
        el("div", { class: "name", style: isDone ? "text-decoration:line-through;color:var(--muted)" : "" }, [t.text]),
        el("div", { class: "sub" }, [sub]),
      ]),
    ]),
  ]);
}

// End-of-day notes (R35): each member writes their own note; the whole team (and the admin) can
// read the day's notes. Saved locally and pushed on the next sync.
function notesSection(app: AppController, date: string): HTMLElement {
  const me = app.repo.get().currentMember;
  const mine = app.repo.myNoteFor(date);
  const others = app.repo.notesFor(date).filter((n) => n.memberId !== me?.id);

  const box = el("textarea", {
    rows: "3", placeholder: "How did the day go? Anything the team should know…",
    style: "width:100%;resize:vertical;font:inherit;padding:10px;border-radius:12px;border:1px solid var(--border,#d9e2df);background:var(--surface)",
  }) as HTMLTextAreaElement;
  box.value = mine?.text ?? "";

  const status = el("span", { class: "hint" }, []);
  const save = el("button", {
    class: "btn secondary", style: "width:auto",
    async onclick() {
      await app.repo.setMyNote(date, box.value);
      status.textContent = "Saved";
      setTimeout(() => { status.textContent = ""; }, 1500);
    },
  }, ["Save note"]);

  return el("div", {}, [
    el("div", { class: "section-title" }, ["End-of-day notes"]),
    el("div", { class: "card", style: "padding:16px" }, [
      me ? el("div", {}, [
        el("label", {}, ["My note"]),
        box,
        el("div", { style: "display:flex;align-items:center;gap:10px;margin-top:8px" }, [save, status]),
      ]) : null,
      ...others.map((n) => noteRow(app, n)),
      !me && !others.length ? el("p", { class: "hint" }, ["No notes yet."]) : null,
    ]),
  ]);
}

function noteRow(app: AppController, n: DailyNote): HTMLElement {
  const author = app.repo.memberById(n.memberId);
  return el("div", { style: "margin-top:14px;border-top:1px solid var(--border,#eef2f1);padding-top:12px" }, [
    el("div", { class: "sub", style: "font-weight:600" }, [author?.name ?? "Team member"]),
    el("div", { class: "sub", style: "white-space:pre-wrap;margin-top:4px" }, [n.text]),
  ]);
}

// Admin: assign a task for the day — free text, an optional assignee and an optional patient.
function openTaskForm(app: AppController, date: string): void {
  const snap = app.repo.get();
  const text = el("input", { type: "text", placeholder: "e.g. Call and confirm evening slots" }) as HTMLInputElement;

  const assignee = el("select", {}, [
    el("option", { value: "" }, ["Anyone on the team"]),
    ...snap.members.map((m) => el("option", { value: m.id }, [m.name])),
  ]) as HTMLSelectElement;

  const patient = el("select", {}, [
    el("option", { value: "" }, ["No specific patient"]),
    ...[...snap.patients].sort((a, b) => a.name.localeCompare(b.name)).map((p) => el("option", { value: p.id }, [p.name])),
  ]) as HTMLSelectElement;

  const save = el("button", {
    class: "btn",
    async onclick() {
      const t = text.value.trim();
      if (!t) return;
      (save as HTMLButtonElement).disabled = true;
      await app.repo.addTask({ date, text: t, assignedMemberId: assignee.value || undefined, patientId: patient.value || undefined });
      app.closeSheet();
      app.render();
    },
  }, ["Assign task"]) as HTMLButtonElement;

  app.openSheet("Assign a task", [
    el("label", {}, ["Task"]), text,
    el("label", {}, ["Assign to"]), assignee,
    el("label", {}, ["About a patient (optional)"]), patient,
    el("div", { style: "height:12px" }), save,
  ]);
}
