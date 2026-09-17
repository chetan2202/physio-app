// Application repository: an in-memory snapshot of the local database plus write helpers
// that persist to IndexedDB. The UI reads the snapshot and calls mutators, then re-renders.

import type {
  Ailment,
  Attendance,
  Facility,
  InviteCode,
  Member,
  Patient,
  Payment,
  PlanTemplate,
  Role,
} from "../domain/types.js";
import { newId, newInviteCode } from "../domain/ids.js";
import { SEED_AILMENTS } from "../domain/seed-ailments.js";
import { SEED_PLANS } from "../domain/seed-plans.js";
import { getAll, put, remove } from "./idb.js";
import { getCurrentMemberId, setCurrentMemberId } from "./identity.js";

export interface Snapshot {
  facility?: Facility;
  currentMember?: Member;
  members: Member[];
  invites: InviteCode[];
  patients: Patient[];
  attendance: Attendance[];
  payments: Payment[];
  ailments: Ailment[];
  plans: PlanTemplate[];
}

// A full, portable backup of a clinic's data. Also the payload the Drive backup will
// push later (the sync module reuses this serialization).
export interface ExportBundle {
  app: "physio-app";
  schema: number;
  exportedAt: number;
  facility?: Facility;
  members: Member[];
  patients: Patient[];
  attendance: Attendance[];
  payments: Payment[];
  ailments?: Ailment[];
  plans?: PlanTemplate[];
}

export class Repository {
  private snap: Snapshot = {
    members: [],
    invites: [],
    patients: [],
    attendance: [],
    payments: [],
    ailments: [],
    plans: [],
  };

  async load(): Promise<Snapshot> {
    const [facilities, members, invites, patients, attendance, payments, ailments, plans] = await Promise.all([
      getAll<Facility>("facility"),
      getAll<Member>("members"),
      getAll<InviteCode>("invites"),
      getAll<Patient>("patients"),
      getAll<Attendance>("attendance"),
      getAll<Payment>("payments"),
      getAll<Ailment>("ailments"),
      getAll<PlanTemplate>("plans"),
    ]);
    const merged = await this.ensureSeedAilments(ailments);
    const savedId = getCurrentMemberId();
    // This device's identity wins by persisted id; fall back to the flag for pre-sync installs.
    const current = (savedId && members.find((m) => m.id === savedId)) || members.find((m) => m.isCurrentUser);
    // Lock in the resolved id before any peer (also flagged isCurrentUser) syncs in and makes the
    // flag ambiguous — self-heals existing single-device installs that predate the persisted id.
    if (!savedId && current) setCurrentMemberId(current.id);
    this.snap = {
      facility: facilities[0],
      currentMember: current,
      members,
      invites,
      patients,
      attendance,
      payments,
      ailments: merged,
      plans,
    };
    return this.snap;
  }

  // Ensure every shipped seed ailment is present (idempotent upsert by id). New seed
  // entries appear on app updates; the admin's custom ailments are untouched.
  private async ensureSeedAilments(existing: Ailment[]): Promise<Ailment[]> {
    const byId = new Map(existing.map((a) => [a.id, a]));
    for (const s of SEED_AILMENTS) {
      if (!byId.has(s.id)) {
        const a: Ailment = { id: s.id, name: s.name, category: s.category, source: "seed" };
        await put("ailments", a);
        byId.set(a.id, a);
      }
    }
    return [...byId.values()];
  }

  get(): Snapshot {
    return this.snap;
  }

  // --- Facility & membership -------------------------------------------------

  async createFacility(name: string, logoDataUrl: string | undefined, adminName: string): Promise<void> {
    const now = Date.now();
    const facility: Facility = { id: newId(), name, logoDataUrl, createdAt: now, updatedAt: now };
    const admin: Member = {
      id: newId(),
      facilityId: facility.id,
      name: adminName,
      role: "admin",
      isCurrentUser: true,
      joinedAt: now,
      updatedAt: now,
    };
    await put("facility", facility);
    await put("members", admin);
    setCurrentMemberId(admin.id);
    this.snap.facility = facility;
    this.snap.currentMember = admin;
    this.snap.members = [admin];
  }

  // Join an existing clinic as staff on a fresh device: adopt the pulled clinic data, then add
  // this device's own staff member and record it as the current identity (R33). The peer bundles
  // are pulled from the admin's Drive by the caller and merged in first.
  async joinAsStaff(name: string, peers: ExportBundle[]): Promise<void> {
    for (const bundle of peers) await this.mergeBundle(bundle);
    const facility = this.requireFacility();
    const now = Date.now();
    const staff: Member = {
      id: newId(),
      facilityId: facility.id,
      name,
      role: "staff",
      isCurrentUser: true,
      joinedAt: now,
      updatedAt: now,
    };
    await put("members", staff);
    setCurrentMemberId(staff.id);
    await this.load();
  }

  async createInvite(role: Role): Promise<InviteCode> {
    const facility = this.requireFacility();
    const invite: InviteCode = {
      code: newInviteCode(),
      facilityId: facility.id,
      role,
      createdAt: Date.now(),
    };
    await put("invites", invite);
    this.snap.invites = [...this.snap.invites, invite];
    return invite;
  }

  async revokeInvite(code: string): Promise<void> {
    await remove("invites", code);
    this.snap.invites = this.snap.invites.filter((i) => i.code !== code);
  }

  async setMemberRole(memberId: string, role: Role): Promise<void> {
    const member = this.snap.members.find((m) => m.id === memberId);
    if (!member) return;
    const updated = { ...member, role, updatedAt: Date.now() };
    await put("members", updated);
    this.snap.members = this.snap.members.map((m) => (m.id === memberId ? updated : m));
    if (updated.isCurrentUser) this.snap.currentMember = updated;
  }

  // --- Patients --------------------------------------------------------------

  async addPatient(input: Omit<Patient, "id" | "facilityId" | "createdAt">): Promise<Patient> {
    const facility = this.requireFacility();
    const now = Date.now();
    const patient: Patient = { ...input, id: newId(), facilityId: facility.id, createdAt: now, updatedAt: now };
    await put("patients", patient);
    this.snap.patients = [...this.snap.patients, patient];
    return patient;
  }

  async updatePatient(id: string, patch: Partial<Omit<Patient, "id" | "facilityId" | "createdAt">>): Promise<void> {
    const existing = this.patientById(id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await put("patients", updated);
    this.snap.patients = this.snap.patients.map((p) => (p.id === id ? updated : p));
  }

  patientById(id: string): Patient | undefined {
    return this.snap.patients.find((p) => p.id === id);
  }

  memberById(id: string | undefined): Member | undefined {
    if (!id) return undefined;
    return this.snap.members.find((m) => m.id === id);
  }

  // Family = other patients sharing the same non-empty phone number (R61).
  familyOf(patient: Patient): Patient[] {
    const phone = patient.phone?.trim();
    if (!phone) return [];
    return this.snap.patients.filter((p) => p.id !== patient.id && p.phone?.trim() === phone);
  }

  // All data for a patient's family (the patient + phone-mates + their visits/payments) —
  // the payload shared with the patient app via QR (R32).
  familyDataFor(patientId: string): { patients: Patient[]; attendance: Attendance[]; payments: Payment[] } {
    const p = this.patientById(patientId);
    if (!p) return { patients: [], attendance: [], payments: [] };
    const family = [p, ...this.familyOf(p)];
    const ids = new Set(family.map((f) => f.id));
    return {
      patients: family,
      attendance: this.snap.attendance.filter((a) => ids.has(a.patientId)),
      payments: this.snap.payments.filter((pay) => ids.has(pay.patientId)),
    };
  }

  // Patients already on file with this phone (for the family hint when adding/editing).
  patientsWithPhone(phone: string, excludeId?: string): Patient[] {
    const norm = phone.trim();
    if (!norm) return [];
    return this.snap.patients.filter((p) => p.id !== excludeId && p.phone?.trim() === norm);
  }

  // Patient ids with at least one visit on the given ISO date (for the "Today" segment).
  patientIdsSeenOn(date: string): Set<string> {
    const ids = new Set<string>();
    for (const a of this.snap.attendance) if (a.date === date) ids.add(a.patientId);
    return ids;
  }

  // --- Ailments (R62-R63) ----------------------------------------------------

  ailments(): Ailment[] {
    return [...this.snap.ailments].sort((a, b) => a.name.localeCompare(b.name));
  }

  ailmentById(id: string | undefined): Ailment | undefined {
    if (!id) return undefined;
    return this.snap.ailments.find((a) => a.id === id);
  }

  // A patient's ailment display name — the selected ailment, or the legacy free-text.
  ailmentNameFor(patient: Patient): string | undefined {
    return this.ailmentById(patient.ailmentId)?.name ?? patient.treatment?.trim() ?? undefined;
  }

  async addAilment(name: string): Promise<Ailment> {
    const trimmed = name.trim();
    const existing = this.snap.ailments.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const ailment: Ailment = { id: newId(), name: trimmed, source: "custom" };
    await put("ailments", ailment);
    this.snap.ailments = [...this.snap.ailments, ailment];
    return ailment;
  }

  // Distinct ailment display names in use across patients, sorted (for the filter chips).
  ailmentsInUse(): string[] {
    const set = new Set<string>();
    for (const p of this.snap.patients) {
      const name = this.ailmentNameFor(p);
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  // --- Plan library (R64-R65) ------------------------------------------------

  plans(): PlanTemplate[] {
    return [...this.snap.plans].sort((a, b) => a.title.localeCompare(b.title));
  }

  planById(id: string | undefined): PlanTemplate | undefined {
    if (!id) return undefined;
    return this.snap.plans.find((p) => p.id === id);
  }

  plansAdopted(): boolean {
    return this.snap.facility?.plansAdopted ?? false;
  }

  // The one-time seed choice (R65): adopt the starter plans, or start empty. Either way the
  // library becomes the admin's own and is never re-seeded.
  async adoptSeedPlans(withSeed: boolean): Promise<void> {
    if (withSeed) {
      for (const s of SEED_PLANS) {
        const plan: PlanTemplate = { id: s.id, title: s.title, pointers: [...s.pointers], source: "seed" };
        await put("plans", plan);
        this.snap.plans = [...this.snap.plans.filter((p) => p.id !== plan.id), plan];
      }
    }
    await this.setFacility({ plansAdopted: true });
  }

  async addPlan(title: string, pointers: string[]): Promise<PlanTemplate> {
    const plan: PlanTemplate = { id: newId(), title: title.trim(), pointers, source: "custom", updatedAt: Date.now() };
    await put("plans", plan);
    this.snap.plans = [...this.snap.plans, plan];
    return plan;
  }

  async updatePlan(id: string, patch: Partial<Pick<PlanTemplate, "title" | "pointers">>): Promise<void> {
    const existing = this.planById(id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await put("plans", updated);
    this.snap.plans = this.snap.plans.map((p) => (p.id === id ? updated : p));
  }

  async deletePlan(id: string): Promise<void> {
    await remove("plans", id);
    this.snap.plans = this.snap.plans.filter((p) => p.id !== id);
  }

  private async setFacility(patch: Partial<Facility>): Promise<void> {
    if (!this.snap.facility) return;
    const updated = { ...this.snap.facility, ...patch, updatedAt: Date.now() };
    await put("facility", updated);
    this.snap.facility = updated;
  }

  // --- Attendance ------------------------------------------------------------

  async markAttendance(patientId: string, date: string, time: string | undefined): Promise<void> {
    const facility = this.requireFacility();
    const member = this.requireMember();
    const record: Attendance = {
      id: newId(),
      facilityId: facility.id,
      patientId,
      date,
      time,
      markedByMemberId: member.id,
      createdAt: Date.now(),
    };
    await put("attendance", record);
    this.snap.attendance = [...this.snap.attendance, record];
  }

  attendanceFor(patientId: string): Attendance[] {
    return this.snap.attendance
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  // --- Payments --------------------------------------------------------------

  async markFeesPaid(patientId: string, coveredDates: string[], amount: number): Promise<void> {
    const facility = this.requireFacility();
    const member = this.requireMember();
    const payment: Payment = {
      id: newId(),
      facilityId: facility.id,
      patientId,
      coveredDates,
      amount,
      paidAt: Date.now(),
      markedByMemberId: member.id,
    };
    await put("payments", payment);
    this.snap.payments = [...this.snap.payments, payment];
  }

  paidDatesFor(patientId: string): Set<string> {
    const paid = new Set<string>();
    for (const p of this.snap.payments) {
      if (p.patientId === patientId) for (const d of p.coveredDates) paid.add(d);
    }
    return paid;
  }

  hasVisitOn(patientId: string, date: string): boolean {
    return this.snap.attendance.some((a) => a.patientId === patientId && a.date === date);
  }

  // Remove all visits for a patient on a date (used by the calendar day editor).
  async removeAttendanceOn(patientId: string, date: string): Promise<void> {
    const toRemove = this.snap.attendance.filter((a) => a.patientId === patientId && a.date === date);
    for (const a of toRemove) await remove("attendance", a.id);
    this.snap.attendance = this.snap.attendance.filter((a) => !(a.patientId === patientId && a.date === date));
  }

  // Toggle a single day's paid status. Marking paid records a payment covering that day;
  // unmarking removes the day from any payment that covers it (dropping empty payments).
  async setDayPaid(patientId: string, date: string, paid: boolean): Promise<void> {
    if (paid) {
      if (!this.paidDatesFor(patientId).has(date)) await this.markFeesPaid(patientId, [date], 0);
      return;
    }
    const next: Payment[] = [];
    for (const p of this.snap.payments) {
      if (p.patientId === patientId && p.coveredDates.includes(date)) {
        const remaining = p.coveredDates.filter((d) => d !== date);
        if (remaining.length) { const upd = { ...p, coveredDates: remaining }; await put("payments", upd); next.push(upd); }
        else await remove("payments", p.id);
      } else next.push(p);
    }
    this.snap.payments = next;
  }

  // Mark every outstanding (unpaid) visit day as paid — the "no dues" action (R70).
  async markAllDuePaid(patientId: string): Promise<void> {
    const paid = this.paidDatesFor(patientId);
    const due = [...new Set(this.attendanceFor(patientId).map((v) => v.date).filter((d) => !paid.has(d)))];
    if (due.length) await this.markFeesPaid(patientId, due, 0);
  }

  // --- Backup / restore (R42) -----------------------------------------------

  exportData(): ExportBundle {
    const s = this.snap;
    return {
      app: "physio-app",
      schema: 2,
      exportedAt: Date.now(),
      facility: s.facility,
      members: s.members,
      patients: s.patients,
      attendance: s.attendance,
      payments: s.payments,
      // Custom ailments only — seed ailments are re-seeded on load, not carried in backups.
      ailments: s.ailments.filter((a) => a.source === "custom"),
      plans: s.plans,
    };
  }

  // A patient-summary CSV of all data (name, ailment, visit/due/collected rollups). Useful
  // for month-end billing; works the same in the admin-only and synced app.
  exportCsv(): string {
    const cols = [
      "Name", "Age", "Sex", "Phone", "Ailment", "Ailment notes", "Assigned to",
      "Total visits", "Due visits", "Amount collected", "Last visit",
    ];
    const rows = [...this.snap.patients]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const visits = this.attendanceFor(p.id);
        const paid = this.paidDatesFor(p.id);
        const due = visits.filter((v) => !paid.has(v.date)).length;
        const collected = this.snap.payments
          .filter((pay) => pay.patientId === p.id)
          .reduce((sum, pay) => sum + (pay.amount ?? 0), 0);
        const lastVisit = visits[0]?.date ?? "";
        return [
          p.name,
          p.age != null ? String(p.age) : "",
          p.gender,
          p.phone ?? "",
          this.ailmentNameFor(p) ?? "",
          p.ailmentNotes ?? "",
          this.memberById(p.assignedMemberId)?.name ?? "",
          String(visits.length),
          String(due),
          collected ? String(collected) : "",
          lastVisit,
        ];
      });
    return [cols, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  }

  // Restore/merge a backup. Records are upserted by id (no wipe), so restoring onto an
  // existing device is safe and importing onto a fresh device loads everything.
  async importData(bundle: ExportBundle): Promise<{ records: number }> {
    if (!bundle || bundle.app !== "physio-app") throw new Error("This file is not a Physio backup.");
    let records = 0;
    if (bundle.facility) { await put("facility", bundle.facility); records++; }
    for (const m of bundle.members ?? []) { await put("members", m); records++; }
    for (const p of bundle.patients ?? []) { await put("patients", p); records++; }
    for (const a of bundle.attendance ?? []) { await put("attendance", a); records++; }
    for (const p of bundle.payments ?? []) { await put("payments", p); records++; }
    for (const a of bundle.ailments ?? []) { await put("ailments", a); records++; }
    for (const p of bundle.plans ?? []) { await put("plans", p); records++; }
    await this.load();
    return { records };
  }

  // --- Sync merge (M9) -------------------------------------------------------
  // Merge a peer device's bundle into local storage with **last-writer-wins** on editable
  // records (by updatedAt) and **union** on additive records (attendance, payments, ailments —
  // added once, never edited). This is the reducer the SyncPort feeds; it is commutative and
  // idempotent, so applying the same bundle twice is a no-op.
  async mergeBundle(bundle: ExportBundle): Promise<{ applied: number }> {
    if (!bundle || bundle.app !== "physio-app") throw new Error("Not a Physio bundle.");
    let applied = 0;
    const ts = (r: { updatedAt?: number; createdAt?: number }): number => r.updatedAt ?? r.createdAt ?? 0;

    // Last-writer-wins for editable, id-keyed collections.
    const lww = async <T extends { id: string; updatedAt?: number; createdAt?: number }>(
      store: "members" | "patients" | "plans", incoming: T[], local: T[],
    ) => {
      const byId = new Map(local.map((r) => [r.id, r]));
      for (const inc of incoming) {
        const cur = byId.get(inc.id);
        if (!cur || ts(inc) > ts(cur)) { await put(store, inc); applied++; }
      }
    };
    await lww("members", bundle.members ?? [], this.snap.members);
    await lww("patients", bundle.patients ?? [], this.snap.patients);
    await lww("plans", bundle.plans ?? [], this.snap.plans);

    // Union (add-if-absent) for additive, id-keyed collections.
    const union = async <T extends { id: string }>(store: "attendance" | "payments" | "ailments", incoming: T[], local: T[]) => {
      const ids = new Set(local.map((r) => r.id));
      for (const inc of incoming) if (!ids.has(inc.id)) { await put(store, inc); applied++; }
    };
    await union("attendance", bundle.attendance ?? [], this.snap.attendance);
    await union("payments", bundle.payments ?? [], this.snap.payments);
    await union("ailments", (bundle.ailments ?? []).filter((a) => a.source === "custom"), this.snap.ailments);

    // Facility: last-writer-wins (never overwrite a newer local facility).
    if (bundle.facility && (!this.snap.facility || ts(bundle.facility) > ts(this.snap.facility))) {
      await put("facility", { ...bundle.facility }); applied++;
    }
    await this.load();
    return { applied };
  }

  // --- helpers ---------------------------------------------------------------

  private requireFacility(): Facility {
    if (!this.snap.facility) throw new Error("No facility set up");
    return this.snap.facility;
  }
  private requireMember(): Member {
    if (!this.snap.currentMember) throw new Error("No current member");
    return this.snap.currentMember;
  }
}

// Quote a CSV cell when it contains a comma, quote, or newline (RFC 4180).
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

