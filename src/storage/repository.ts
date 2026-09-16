// Application repository: an in-memory snapshot of the local database plus write helpers
// that persist to IndexedDB. The UI reads the snapshot and calls mutators, then re-renders.

import type {
  Attendance,
  Facility,
  InviteCode,
  Member,
  Patient,
  Payment,
  Role,
} from "../domain/types.js";
import { newId, newInviteCode } from "../domain/ids.js";
import { getAll, put, remove } from "./idb.js";

export interface Snapshot {
  facility?: Facility;
  currentMember?: Member;
  members: Member[];
  invites: InviteCode[];
  patients: Patient[];
  attendance: Attendance[];
  payments: Payment[];
}

// A full, portable backup of a clinic's data. Also the payload the Drive backup will
// push later (the sync module reuses this serialization).
export interface ExportBundle {
  app: "physio-app";
  schema: 1;
  exportedAt: number;
  facility?: Facility;
  members: Member[];
  patients: Patient[];
  attendance: Attendance[];
  payments: Payment[];
}

export class Repository {
  private snap: Snapshot = {
    members: [],
    invites: [],
    patients: [],
    attendance: [],
    payments: [],
  };

  async load(): Promise<Snapshot> {
    const [facilities, members, invites, patients, attendance, payments] = await Promise.all([
      getAll<Facility>("facility"),
      getAll<Member>("members"),
      getAll<InviteCode>("invites"),
      getAll<Patient>("patients"),
      getAll<Attendance>("attendance"),
      getAll<Payment>("payments"),
    ]);
    this.snap = {
      facility: facilities[0],
      currentMember: members.find((m) => m.isCurrentUser),
      members,
      invites,
      patients,
      attendance,
      payments,
    };
    return this.snap;
  }

  get(): Snapshot {
    return this.snap;
  }

  // --- Facility & membership -------------------------------------------------

  async createFacility(name: string, logoDataUrl: string | undefined, adminName: string): Promise<void> {
    const facility: Facility = { id: newId(), name, logoDataUrl, createdAt: Date.now() };
    const admin: Member = {
      id: newId(),
      facilityId: facility.id,
      name: adminName,
      role: "admin",
      isCurrentUser: true,
      joinedAt: Date.now(),
    };
    await put("facility", facility);
    await put("members", admin);
    this.snap.facility = facility;
    this.snap.currentMember = admin;
    this.snap.members = [admin];
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
    const updated = { ...member, role };
    await put("members", updated);
    this.snap.members = this.snap.members.map((m) => (m.id === memberId ? updated : m));
    if (updated.isCurrentUser) this.snap.currentMember = updated;
  }

  // --- Patients --------------------------------------------------------------

  async addPatient(input: Omit<Patient, "id" | "facilityId" | "createdAt">): Promise<Patient> {
    const facility = this.requireFacility();
    const patient: Patient = { ...input, id: newId(), facilityId: facility.id, createdAt: Date.now() };
    await put("patients", patient);
    this.snap.patients = [...this.snap.patients, patient];
    return patient;
  }

  async updatePatient(id: string, patch: Partial<Omit<Patient, "id" | "facilityId" | "createdAt">>): Promise<void> {
    const existing = this.patientById(id);
    if (!existing) return;
    const updated = { ...existing, ...patch };
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

  // Patient ids with at least one visit on the given ISO date (for the "Today" segment).
  patientIdsSeenOn(date: string): Set<string> {
    const ids = new Set<string>();
    for (const a of this.snap.attendance) if (a.date === date) ids.add(a.patientId);
    return ids;
  }

  // Distinct, non-empty treatment values in use, sorted.
  treatments(): string[] {
    const set = new Set<string>();
    for (const p of this.snap.patients) if (p.treatment?.trim()) set.add(p.treatment.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
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

  // --- Backup / restore (R42) -----------------------------------------------

  exportData(): ExportBundle {
    const s = this.snap;
    return {
      app: "physio-app",
      schema: 1,
      exportedAt: Date.now(),
      facility: s.facility,
      members: s.members,
      patients: s.patients,
      attendance: s.attendance,
      payments: s.payments,
    };
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
    await this.load();
    return { records };
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
