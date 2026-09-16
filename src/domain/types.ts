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

export interface Facility {
  id: string;
  name: string;
  logoDataUrl?: string; // optional, small data URL
  createdAt: number;
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
  phone: string; // NOT unique — multiple patients may share a number (families). See R7.
  gender: Gender;
  address?: string;
  treatment?: string; // condition / treatment line, used for segmentation (R8)
  assignedMemberId?: string; // therapist responsible (R9)
  createdAt: number;
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
