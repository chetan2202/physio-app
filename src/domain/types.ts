// Domain model for physio-app v0. Everything is stored locally (IndexedDB).
// Google Drive sync is deferred to v0.1; the model is kept sync-friendly (flat records
// keyed by id, with a facilityId foreign key) so a sync layer can be added later.

// No HOD role: the Admin plays the senior/HOD role too. There can be more than one Admin.
// (Patient is a separate, paid-tier app and not part of this member model.)
export type Role = "admin" | "staff";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  staff: "Staff",
};

export type Gender = "male" | "female" | "other";

export type VisitType = "clinic" | "home";
export type ScheduleKind = "one-time" | "daily" | "weekly";

// Recurring pattern (R67). weekdays: 0=Sun .. 6=Sat, used when kind === "weekly".
export interface Schedule {
  kind: ScheduleKind;
  weekdays?: number[];
}

// Master ailment list entry (R62-R63). Seed entries ship with the app; the admin can add
// their own (source: "custom").
export interface Ailment {
  id: string;
  name: string;
  category?: string;
  source: "seed" | "custom";
}

export interface Facility {
  id: string;
  name: string;
  logoDataUrl?: string; // optional, small data URL
  plansAdopted?: boolean; // the admin has made the one-time seed-plan choice (R65)
  createdAt: number;
}

// An item in the admin's treatment-plan library (R64-R65): a title + pointers.
export interface PlanTemplate {
  id: string;
  title: string;
  pointers: string[];
  source: "seed" | "custom";
}

// A plan as assigned to a patient — a snapshot (not a live link to the template).
export interface PatientPlan {
  title: string;
  pointers: string[];
}

export interface Member {
  id: string;
  facilityId: string;
  name: string;
  role: Role;
  isCurrentUser: boolean; // the person using this device
  joinedAt: number;
}

export interface InviteCode {
  code: string;
  facilityId: string;
  role: Role;
  createdAt: number;
}

export interface Patient {
  id: string;
  facilityId: string;
  name: string;
  age?: number;
  phone?: string; // optional, NOT unique — shared numbers group a family (R61)
  gender: Gender;
  address?: string;
  ailmentId?: string; // selected from the master ailment list (R62)
  ailmentNotes?: string; // optional free-text notes on the ailment (R62)
  plan?: PatientPlan; // treatment plan snapshot (R64)
  visitType?: VisitType; // clinic or home visit (R66); default clinic
  schedule?: Schedule; // recurring pattern (R67); default one-time
  treatment?: string; // legacy free-text condition (pre-M14); shown as fallback until edited
  assignedMemberId?: string; // therapist responsible (R9)
  createdAt: number;
}

// Weekday short labels, index 0=Sun .. 6=Sat.
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// A human-readable summary of a patient's schedule.
export function scheduleLabel(s: Schedule | undefined): string {
  if (!s || s.kind === "one-time") return "One-time";
  if (s.kind === "daily") return "Daily";
  const days = (s.weekdays ?? []).slice().sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "Weekly";
  return days.map((d) => WEEKDAYS[d]).join(", ");
}

export interface Attendance {
  id: string;
  facilityId: string;
  patientId: string;
  date: string; // ISO date, YYYY-MM-DD
  time?: string; // optional HH:MM
  markedByMemberId: string;
  createdAt: number;
}

export interface Payment {
  id: string;
  facilityId: string;
  patientId: string;
  // The days this payment covers, as ISO dates. A weekly/monthly payment simply
  // records the set of covered days, so partial (unselected) days are exact.
  coveredDates: string[];
  amount: number;
  paidAt: number;
  markedByMemberId: string;
}

// Roles allowed to perform each action. Admin covers everything the HOD used to; Staff
// only marks attendance.
export function canAddPatient(role: Role): boolean {
  return role === "admin";
}
export function canMarkAttendance(role: Role): boolean {
  return role === "admin" || role === "staff";
}
export function canMarkFees(role: Role): boolean {
  return role === "admin";
}
export function canManageMembers(role: Role): boolean {
  return role === "admin";
}
