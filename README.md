# physio-app

A Progressive Web App (PWA) for managing a physiotherapy center — patients, daily attendance, and fee collection — built for a small clinic with a handful of staff and 60+ regular patients.

## Install the app

**Live app: https://chetan2202.github.io/physio-app/**

It is an installable, offline-first PWA — no app store needed:

- **Android / Chrome:** open the link, then menu (⋮) → *Add to Home screen* / *Install app*.
- **iOS / Safari:** open the link, then Share → *Add to Home Screen*.
- **Desktop / Chrome or Edge:** open the link, then the install icon in the address bar.

Once installed it launches full-screen and works offline. Data is stored locally on the device (IndexedDB).

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

## Tech stack

Built the same way as the sibling `suno-app` project:

- **Vite + vanilla TypeScript** (no UI framework) — small, fast, dependency-light.
- **vite-plugin-pwa** (Workbox) — service worker, offline shell, installable manifest.
- **IndexedDB** — local-first storage (a thin, dependency-free wrapper).
- **Flat inline SVG icons** — no emoji, no icon dependency.
- **GitHub Pages** via GitHub Actions — every push to `main` builds and deploys.

Layout: `src/domain` (types & rules), `src/storage` (IndexedDB + repository), `src/ui` (app shell + views). Icons are generated dependency-free by `scripts/generate-icons.mjs`.

### Develop

```bash
npm install
npm run icons   # regenerate PWA icons into public/icons
npm run dev     # local dev server
npm run build   # type-check + production build into dist/
```

## Design principles

- Minimalist, flat design.
- Flat icons only — **no emoji in icons or inside code**.
- Design inspiration drawn from the Suno app.

## Requirements & roadmap

Full, ID'd requirements (including the roadmap and statuses) live in [requirements.md](./requirements.md).

Highlights of what's accepted next (from user feedback after installing v0):

- **Patient segmentation (R10–R13)** — at 60–100 patients a flat list doesn't scale. Add
  filtering/grouping by **treatment**, **today's schedule**, and **assigned staff**, plus search.
- **Shared phone numbers (R7)** — more than one patient may have the same phone (families); the
  app must never block or de-duplicate on phone.
- **Better app icon (R42)** — done: replaced the generic plus with an active-figure mark.
- **Google Drive sync (R30)** — the keystone that makes the app multi-device; see requirements.md §7.

## Status

**v0 shipped and live.** Facility setup, members & roles (with invite code + QR generation), patients, attendance, and fee collection all work offline on-device. Cross-device sharing via Google Drive sync is the next milestone (v0.1).
