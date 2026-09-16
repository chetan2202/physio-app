# physio-app

A Progressive Web App (PWA) for managing a physiotherapy center — patients, daily attendance, and fee collection — designed for a small clinic with a handful of staff and dozens of regular patients.

## Install the app

**Live app: https://chetan2202.github.io/physio-app/**

It is an installable, offline-first PWA — no app store needed:

- **Android / Chrome:** open the link, then menu (⋮) → *Add to Home screen* / *Install app*.
- **iOS / Safari:** open the link, then Share → *Add to Home Screen*.
- **Desktop / Chrome or Edge:** open the link, then the install icon in the address bar.

Once installed it launches full-screen and works offline. Data is stored locally on the device (IndexedDB).

## What it does

A physiotherapy center needs to:

- Share the day's treatment plan with staff.
- Record a patient's visit every time they come in.
- Bill patients weekly or monthly from those visits.
- Record fee payments flexibly — daily, weekly, monthly, or by selecting/unselecting specific days or weeks and marking them paid.

## Roles

| Role  | Capabilities |
|-------|--------------|
| **Admin** | Full access. Creates the facility, adds patients, marks attendance, marks fees paid, manages members and roles. |
| **HOD**   | Adds patients, marks attendance, marks fees paid. |
| **Staff** | Marks attendance. |

## How it works

1. One user creates a **facility** — names it and sets an optional logo.
2. The app generates a **QR code / invitation code** tied to a selected role. Others install the app and join by scanning or entering the code.
3. Admin can change any member's role later.

## Features

- Add a **patient**: name, age, phone number, gender, address (optional). Multiple patients may share a phone number.
- **Mark attendance** for a patient: select the date (time optional), with per-patient history.
- **Mark fees paid** across a selectable set of visit days.
- **Patient segmentation** for managing many patients: search and filter by treatment, today's visits, or assigned staff.

## Tech stack

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
- Flat icons only — no emoji in icons or inside code.

## Roadmap

The app is fully functional on a single device today. Planned next:

- **Optional cloud sync** — share a facility across devices and team members (single-device use continues to work without it).
- **Daily schedule** — a forward-looking view of the patients planned for the day.
- **Billing summaries** — weekly and monthly totals per patient and for the facility.

## Status

Facility setup, members and roles (with invite code / QR generation), patients, attendance, fee collection, and patient segmentation all work offline on-device. Cross-device sync is the next milestone.
