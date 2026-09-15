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

  patientById(id: string): Patient | undefined {
    return this.snap.patients.find((p) => p.id === id);
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
