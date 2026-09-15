# Requirements — physio-app

Comprehensive requirements for the physiotherapy-center PWA. Requirement IDs (`R#`) are
stable references used by `plan.md` and commit messages. Status legend:
**Done** (shipped in v0) · **Planned** (accepted, not yet built) · **Deferred** (later).

---

## 1. Context & goals

A physiotherapy center owner (Admin) with 5–6 staff and **60–100 regular patients** needs a
simple, shared tool to:

- Communicate the day's treatment/plan to staff.
- Have staff record each patient's visit (attendance).
- Bill patients weekly or monthly from those visits.
- Record fee payments flexibly.

The app is **local-first and offline-first**, installable as a PWA, minimalist and flat, with
**no emoji anywhere** (icons or code). Cross-device data sharing is via **Google Drive sync**
(see §7).

## 2. Roles & permissions

| Capability | Admin | HOD | Staff |
|------------|:----:|:---:|:----:|
| Create / configure facility | Yes | No | No |
| Manage members & change roles | Yes | No | No |
| Generate invitation codes / QR | Yes | No | No |
| Add / edit patients | Yes | Yes | No |
| Assign patient to a staff member | Yes | Yes | No |
| Mark attendance | Yes | Yes | Yes |
| Mark fees paid | Yes | Yes | No |
| View patients & schedules | Yes | Yes | Yes |

- **R1** Roles are Admin, HOD, Staff. **Done**
- **R2** Admin can change any member's role after they join. **Done**

## 3. Facility & membership

- **R3** One user creates a facility: name + optional logo; creator becomes Admin. **Done**
- **R4** Admin generates a **role-scoped invitation code and QR** for others to join. **Done**
- **R5** Cross-device join (a scanned/entered code actually attaches a second device to the
  same facility data) requires sync — see **R30**. **Planned** (depends on §7)

## 4. Patients

- **R6** Admin/HOD add a patient: name, age (optional), phone, gender, address (optional). **Done**
- **R7** **Phone numbers are NOT unique.** More than one patient may share the same number
  (families, shared household phones). The app must never block or de-duplicate on phone, and
  should treat name as the primary human identifier while keeping a stable internal id. When a
  number is already on file, the UI *may* show a non-blocking hint ("also used by <name>") but
  must still allow the save. **Planned** (today's build already allows duplicates; the hint is pending)
- **R8** Patient records carry a **treatment/condition** field (e.g. "Lower back", "Post-op knee",
  "Cervical"). Used for grouping and daily planning. **Planned**
- **R9** A patient may be **assigned to a staff member** (the therapist responsible). **Planned**

## 5. Managing 60–100 patients — segmentation (NEW)

A flat list does not scale to 60–100 patients. The team needs to **bifurcate** the list so each
person sees the slice relevant to them. This is a core usability requirement, not a nice-to-have.

- **R10** **Segment by Treatment/condition** — group or filter patients by their treatment so
  the HOD can brief staff per condition and see caseloads at a glance. **Planned**
- **R11** **Today's schedule** — a per-day view of the patients expected/handled today, so staff
  know who to attend to. Two interpretations to confirm with the owner:
  - (a) *Seen today* — patients with a visit already marked today (derivable from existing data).
  - (b) *Scheduled today* — a forward-looking appointment/plan set by Admin/HOD, which needs a
    lightweight **daily schedule/appointment model** (new entity: `ScheduleEntry {patientId,
    date, note}`). Recommended target: (b), with (a) available as a quick filter meanwhile. **Planned**
- **R12** **Assigned to me / by staff** — filter patients by the assigned staff member (see R9)
  so each therapist manages their own caseload. **Planned**
- **R13** The patient list must offer a **segment/filter bar** (All · Today · Assigned to me ·
  by Treatment) plus quick search by name. Must stay fast and legible at 100+ patients. **Planned**

## 6. Attendance & fees

- **R14** Any role marks a patient's visit: select date, time optional. **Done**
- **R15** Attendance history is visible per patient, newest first. **Done**
- **R16** Admin/HOD mark fees paid across a **selectable set of visit days** — daily, weekly,
  monthly, or an arbitrary subset (select then unselect a few), with an amount. **Done**
- **R17** Each visit day shows a paid/due status; the list surfaces outstanding dues per patient. **Done**
- **R18** Weekly/monthly billing summary (per patient and facility total) for the collection cycle. **Planned**

## 7. Google Drive sync (v0.1) — **R30**

The keystone requirement that turns the app from single-device into a shared team tool. Data is
synced through an **Admin-configured Google Drive folder**; there is no custom backend.

### 7.1 What must be built

- **R30.1 Google Cloud setup** — a Google Cloud project, **Drive API enabled**, and an **OAuth 2.0
  Web Client ID** whose authorized JavaScript origin is the app origin
  (`https://chetan2202.github.io`). Configure the OAuth consent screen.
- **R30.2 Client auth** — Google Identity Services (GIS) token flow for SPAs. Request the least
  scope that works: **`drive.file`** (per-file access to files the app itself creates). Admin
  signs in and authorizes; token is held in memory and refreshed.
- **R30.3 Folder selection** — Admin picks or creates the sync folder (Google Picker API, or the
  app creates a dedicated folder). Store the **folder id** in facility settings.
- **R30.4 Sync-friendly data model** — today the app stores only materialized records
  (last-write-wins on whole objects), which corrupts under concurrent multi-device edits. Introduce
  an **append-only operation log**: each change is an op `{id, entity, type, payload, deviceId,
  clock}` reduced deterministically into local state. (This mirrors the sibling `suno-app`
  architecture: `operation-store` + `reducer` + `version-gate`.)
- **R30.5 On-Drive format** — store the facility's data as **per-device op files** in the folder
  (each device only writes its own file, so no write-conflicts), read all peers' files and merge.
  Compress payloads (e.g. `fflate`). Track a per-file sync cursor / Drive revision id.
- **R30.6 Sync engine** — pull remote ops → merge via reducer → push local ops. Handle an offline
  queue, retry with backoff, partial failures, and a manual **"Sync now"** plus sync-on-foreground.
  Use Background/Periodic Sync where the browser supports it.
- **R30.7 Conflict handling** — most ops are additive (add patient, mark visit, mark payment) and
  commute. For edits and role changes use last-writer-wins by timestamp; deletions use **tombstones**.
- **R30.8 Cross-device membership** — decide the account model (a key design choice):
  - **Option A — one shared Google account** on all devices: simplest, no folder sharing, but
    shared credentials.
  - **Option B — each member's own Google account**: Admin shares the Drive folder with each; the
    app then needs broader **`drive`** scope to read files it did not create, which requires Google
    **OAuth app verification**. A Shared Drive is an alternative.
  Recommended for a small clinic: **Option A** for v0.1, revisit B later.
- **R30.9 Version gate** — a device on an older schema must not corrupt the shared log; enforce a
  **minimum app version** (as `suno-app` does) and prompt older devices to update.
- **R30.10 Privacy & security** — patient data is health-adjacent PII. Use least scope
  (`drive.file`), keep everything client-side (no third-party servers), and evaluate **client-side
  encryption** of the synced payload with a facility key derived from the invite. Document data
  sensitivity and retention.
- **R30.11 Tests** — a fake Drive client and deterministic reducer/codec tests so sync logic is
  verifiable offline.

### 7.2 Acceptance

- **R31** After Admin configures Drive and a second device joins via invite code, patients,
  attendance, and payments created on one device appear on the other after a sync, offline edits
  reconcile without loss, and no patient/visit is duplicated or dropped. **Planned**

## 8. Non-functional requirements

- **R40** Installable PWA (manifest + service worker), works fully offline; data in IndexedDB. **Done**
- **R41** Minimalist flat design; **flat SVG icons only, no emoji** in UI or code. **Done**
- **R42** **App icon** must be a distinctive, well-crafted mark — **not a generic plus/medical
  cross**. Use a physiotherapy/wellness motif (an active human figure). **Planned → in progress**
- **R43** Responsive down to ~360px; large tap targets; usable one-handed on a phone.  **Done**
- **R44** Fast at 100+ patients (list virtualization/filtering as needed). **Planned** (see R13)
- **R45** Deployed via GitHub Actions to GitHub Pages on every push to `main`. **Done**
- **R46** No secrets in the repo; OAuth client id is public-by-design but scopes stay minimal. **Planned**

## 9. Out of scope (for now)

- Insurance/claims, prescriptions, clinical notes/EMR, SMS/WhatsApp reminders, multi-branch orgs,
  and payments gateways. Revisit after v0.1 sync ships.
