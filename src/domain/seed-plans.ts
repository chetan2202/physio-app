// Seed treatment-plan library shipped with the app (R65). Each plan is a title + pointers.
// The admin adopts this seed once, then owns an independent library (add/edit/delete).
// Used by M15 (plan library); shipped here alongside the ailment seed.
//
// Ids are stable slugs prefixed "seed:" so the one-time adopt is deterministic.

export const PLANS_SEED_VERSION = 1;

export interface SeedPlan {
  id: string;
  title: string;
  pointers: string[];
}

export const SEED_PLANS: SeedPlan[] = [
  {
    id: "seed:low-back-pain",
    title: "Low back pain",
    pointers: ["Moist heat / IFT", "Core activation", "McKenzie extensions", "Lumbar stretches", "Posture correction", "Pain check"],
  },
  {
    id: "seed:sciatica",
    title: "Sciatica",
    pointers: ["Nerve glides", "McKenzie extensions", "Core stabilization", "Hamstring stretch", "Traction", "Pain check"],
  },
  {
    id: "seed:cervical-spondylosis",
    title: "Cervical spondylosis",
    pointers: ["Heat / IFT", "Isometric neck", "Chin tucks", "Posture correction", "Cervical traction", "Pain check"],
  },
  {
    id: "seed:frozen-shoulder",
    title: "Frozen shoulder",
    pointers: ["Moist heat", "Pendulum exercise", "Capsular stretch", "Wall climbing", "Pulley exercise", "Icing", "ROM check"],
  },
  {
    id: "seed:rotator-cuff",
    title: "Rotator cuff rehab",
    pointers: ["Ice / heat", "Scapular stabilization", "Isometric cuff", "Theraband ER/IR", "ROM", "Pain check"],
  },
  {
    id: "seed:tennis-elbow",
    title: "Tennis elbow",
    pointers: ["Ultrasound / IFT", "Eccentric wrist extension", "Stretching", "Grip strengthening", "Icing"],
  },
  {
    id: "seed:oa-knee",
    title: "Osteoarthritis knee",
    pointers: ["Heat / SWD", "Quadriceps strengthening", "ROM exercises", "Low-impact aerobic", "Weight advice", "Pain check"],
  },
  {
    id: "seed:post-tkr",
    title: "Post-op knee rehab (TKR)",
    pointers: ["Heat pad", "Isometric quads", "ROM / heel slides", "Patellar mobilization", "Icing", "Gait training", "Pain check"],
  },
  {
    id: "seed:post-acl",
    title: "ACL reconstruction (early)",
    pointers: ["Icing / edema control", "Quad sets", "Straight leg raise", "Heel slides", "Patellar mobs", "Weight bearing as tolerated"],
  },
  {
    id: "seed:ankle-sprain",
    title: "Ankle sprain",
    pointers: ["RICE", "Ankle ROM", "Theraband strengthening", "Balance / proprioception", "Gait training"],
  },
  {
    id: "seed:plantar-fasciitis",
    title: "Plantar fasciitis",
    pointers: ["Calf stretch", "Plantar fascia stretch", "Ice rolling", "Foot intrinsic strengthening", "Taping"],
  },
  {
    id: "seed:stroke-rehab",
    title: "Stroke rehab",
    pointers: ["Positioning", "Passive ROM", "Bed mobility", "Sit-to-stand", "Balance training", "Gait training", "Functional tasks"],
  },
  {
    id: "seed:post-fracture",
    title: "Post-fracture rehab",
    pointers: ["Edema management", "ROM restoration", "Progressive strengthening", "Weight-bearing progression", "Functional training"],
  },
  {
    id: "seed:posture-correction",
    title: "Posture correction",
    pointers: ["Postural awareness", "Scapular retraction", "Core strengthening", "Stretch tight muscles", "Ergonomic advice"],
  },
  {
    id: "seed:general-strengthening",
    title: "General strengthening",
    pointers: ["Warm up", "Resistance training", "Stretching", "Cool down"],
  },
];
