# physio-app

A Progressive Web App (PWA) for managing a physiotherapy center — patients, daily attendance, and fee collection — built for a small clinic with a handful of staff and 60+ regular patients.

## Problem

A physiotherapy center owner needs to:

- Communicate the day's treatment plan to staff.
- Have staff mark a patient's entry every time they visit.
- Bill patients accordingly at week-end or month-end.
- Record fee payments flexibly — daily, weekly, monthly, or by selecting/unselecting specific days or weeks and marking them paid.

## Roles

| Role  | Capabilities |
|-------|--------------|
| **Admin** | Full access. Creates the facility, adds patients, marks attendance, marks fees paid, manages members and roles. |
| **HOD**   | Adds patients, marks attendance, marks fees paid. |
| **Staff** | Marks attendance. |

## How it works

1. One user creates a **healthcare facility** — names it and sets an optional logo.
2. The app generates a **QR code / invitation code** tied to a selected role. Others download the app and join by scanning or entering the code.
3. Admin can change any member's role later.

## v0 scope

- Admin/HOD adds a **patient**: name, age, phone number, gender, address (optional).
- Staff/HOD/Admin **marks attendance** for a patient: select the date (time optional).
- Admin/HOD **marks fees paid** across selected days/weeks/months.

**Deferred to v0.1:** Google Drive sync (the app will sync data with an admin-configured Google Drive folder).

## Design principles

- Minimalist, flat design.
- Flat icons only — **no emoji in icons or inside code**.
- Design inspiration drawn from the Suno app.

## Status

Early development. See [plan.md](./plan.md) for the roadmap and milestones.
