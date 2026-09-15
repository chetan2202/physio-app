# Implementation Plan — physio-app

## 1. Goals

Deliver an offline-capable PWA that lets a small physiotherapy center manage patients, daily attendance, and fee collection with three roles (Admin, HOD, Staff). Ship a working v0 without cloud sync; add Google Drive sync in v0.1.

## 2. Proposed tech stack

Chosen to be lightweight, offline-first, and installable — matching the "runs on a PWA" requirement.

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | React + TypeScript | Component model, strong typing, large ecosystem. |
| Build/dev | Vite | Fast dev server, first-class PWA plugin. |
| PWA | `vite-plugin-pwa` (Workbox) | Service worker, offline shell, installable manifest. |
| Local storage | IndexedDB via Dexie | Local-first store; survives offline, ready to sync later. |
| Styling | Tailwind CSS | Minimalist, flat, utility-first; fast to iterate. |
| Icons | lucide-react (flat line icons) | Flat icons, no emoji. |
| Routing | React Router | Standard SPA routing. |
| QR | `qrcode` (generate) + `html5-qrcode` (scan) | Facility invite QR flow. |

> Tech decisions are open to change; this reflects the seed's PWA + minimalist + local-first constraints. Google Drive sync (v0.1) will layer on top of the Dexie store.

## 3. Data model (v0)

- **Facility** — id, name, logo (optional), createdBy.
- **Member** — id, facilityId, name, role (`admin` | `hod` | `staff`), joinedAt.
- **InviteCode** — code, facilityId, role, expiresAt (optional).
- **Patient** — id, facilityId, name, age, phone, gender, address (optional), createdBy, createdAt.
- **Attendance** — id, patientId, date, time (optional), markedBy.
- **Payment** — id, patientId, period (set of dates/weeks/months), amount, paidAt, markedBy.

## 4. Milestones

### M0 — Project scaffold
- Vite + React + TS project, Tailwind, PWA plugin, Dexie setup.
- App shell: installable, offline-loads, manifest + icons.

### M1 — Facility & membership
- Create facility (name + optional logo).
- Generate role-scoped invitation code + QR.
- Join facility via code/QR.
- Admin can change a member's role.

### M2 — Patients
- Add patient (Admin/HOD): name, age, phone, gender, address optional.
- List/search patients.

### M3 — Attendance
- Mark attendance (Admin/HOD/Staff): pick patient, select date, optional time.
- View a patient's attendance history.

### M4 — Fees
- Mark fees paid (Admin/HOD) across selected days/weeks/months, with select/unselect.
- View payment status and outstanding periods per patient.

### M5 — Polish
- Role-based UI gating, empty states, minimalist flat visual pass (Suno-inspired).
- Basic reports: weekly/monthly billing summary.

### v0.1 — Google Drive sync
- Admin configures a Drive folder.
- Two-way sync of the Dexie store; conflict handling.

## 5. Open questions

- Authentication model for v0 (device-local identity vs. account-based)?
- Are patient records shared across all members of a facility (assumed yes)?
- Fee amounts: fixed per visit, or per-patient rate?
- Offline conflict strategy once multiple devices sync via Drive.

## 6. Progress

- **M0–M5 done** and deployed. The stack shipped as **Vite + vanilla TypeScript** (matching the sibling `suno-app`) rather than React — lighter and framework-free. Live at https://chetan2202.github.io/physio-app/ via GitHub Pages.
  - Facility setup (creator is Admin), members & role management, invite code + QR generation.
  - Add patient (Admin/HOD); patient list with a "due" badge.
  - Mark attendance (all roles) with optional time; attendance history.
  - Mark fees paid across a selectable set of visit days (Admin/HOD), with select-all/clear.
  - Local-first IndexedDB storage; installable offline PWA.

## 7. Accepted next (from v0 user feedback)

See [requirements.md](./requirements.md) for full detail; IDs referenced below.

### M6 — App icon (R42) — DONE
- Replaced the generic plus/medical cross with an active human-figure mark (movement/wellness).

### M7 — Patient segmentation for 60–100 patients (R8–R13)
- Add `treatment` (condition) and `assignedMemberId` to the Patient model.
- Add a **segment/filter bar** to the home list: All · Today · Assigned to me · by Treatment, plus name search.
- **Today's schedule (R11):** confirm interpretation with the owner — (a) "seen today" from
  attendance vs. (b) a forward-looking daily schedule model (`ScheduleEntry`). Target (b), ship (a) meanwhile.

### M8 — Shared phone numbers (R7)
- Guarantee phone is never unique; optional non-blocking "also used by <name>" hint on add.

### M9 — Billing summary (R18)
- Weekly/monthly totals per patient and facility.

### v0.1 — Google Drive sync (R30) — the keystone
Admin configures a Drive folder; two-way sync of the local store enables the multi-device facility
join (invite codes/QR already generate). Build order:
1. Google Cloud project + Drive API + OAuth Web Client (`drive.file` scope). (R30.1–R30.2)
2. Folder selection + store folder id in facility settings. (R30.3)
3. Refactor storage to an **append-only operation log + deterministic reducer** (sync-safe). (R30.4)
4. On-Drive per-device op files, compressed; pull/merge/push sync engine with offline queue. (R30.5–R30.7)
5. Cross-device membership + account model decision (shared account vs. per-user + folder share). (R30.8)
6. Version gate, privacy (least scope, consider client-side encryption), and reducer/codec tests. (R30.9–R30.11)
