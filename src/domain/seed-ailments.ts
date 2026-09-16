// Master ailment list shipped with the app (R63). This is a starter seed for a
// physiotherapy clinic; it is versioned and updated with app releases. The admin can add
// their own ailments on top of this list (source: "custom").
//
// Ids are stable slugs prefixed "seed:" so re-seeding on update is idempotent (upsert by id).

export const AILMENTS_SEED_VERSION = 1;

export interface SeedAilment {
  id: string;
  name: string;
  category: string;
}

export const SEED_AILMENTS: SeedAilment[] = [
  // Spine & back
  { id: "seed:low-back-pain", name: "Low back pain", category: "Spine & back" },
  { id: "seed:lumbar-pivd", name: "Lumbar disc prolapse (PIVD)", category: "Spine & back" },
  { id: "seed:sciatica", name: "Sciatica", category: "Spine & back" },
  { id: "seed:cervical-spondylosis", name: "Cervical spondylosis", category: "Spine & back" },
  { id: "seed:neck-pain", name: "Neck pain", category: "Spine & back" },
  { id: "seed:thoracic-pain", name: "Thoracic / mid-back pain", category: "Spine & back" },
  { id: "seed:postural-dysfunction", name: "Postural dysfunction", category: "Spine & back" },
  { id: "seed:ankylosing-spondylitis", name: "Ankylosing spondylitis", category: "Spine & back" },
  { id: "seed:scoliosis", name: "Scoliosis", category: "Spine & back" },

  // Shoulder & upper limb
  { id: "seed:frozen-shoulder", name: "Frozen shoulder (adhesive capsulitis)", category: "Shoulder & upper limb" },
  { id: "seed:rotator-cuff", name: "Rotator cuff injury", category: "Shoulder & upper limb" },
  { id: "seed:shoulder-impingement", name: "Shoulder impingement", category: "Shoulder & upper limb" },
  { id: "seed:tennis-elbow", name: "Tennis elbow (lateral epicondylitis)", category: "Shoulder & upper limb" },
  { id: "seed:golfers-elbow", name: "Golfer's elbow (medial epicondylitis)", category: "Shoulder & upper limb" },
  { id: "seed:carpal-tunnel", name: "Carpal tunnel syndrome", category: "Shoulder & upper limb" },
  { id: "seed:de-quervain", name: "De Quervain's tenosynovitis", category: "Shoulder & upper limb" },
  { id: "seed:wrist-sprain", name: "Wrist sprain", category: "Shoulder & upper limb" },

  // Hip, knee & lower limb
  { id: "seed:oa-knee", name: "Osteoarthritis of knee", category: "Hip, knee & lower limb" },
  { id: "seed:knee-ligament", name: "Knee ligament injury (ACL/PCL/MCL)", category: "Hip, knee & lower limb" },
  { id: "seed:meniscus", name: "Meniscus injury", category: "Hip, knee & lower limb" },
  { id: "seed:patellofemoral", name: "Patellofemoral pain", category: "Hip, knee & lower limb" },
  { id: "seed:oa-hip", name: "Hip osteoarthritis", category: "Hip, knee & lower limb" },
  { id: "seed:trochanteric-bursitis", name: "Trochanteric bursitis", category: "Hip, knee & lower limb" },
  { id: "seed:hamstring-strain", name: "Hamstring strain", category: "Hip, knee & lower limb" },
  { id: "seed:calf-strain", name: "Calf strain", category: "Hip, knee & lower limb" },
  { id: "seed:achilles-tendinopathy", name: "Achilles tendinopathy", category: "Hip, knee & lower limb" },
  { id: "seed:plantar-fasciitis", name: "Plantar fasciitis", category: "Hip, knee & lower limb" },
  { id: "seed:ankle-sprain", name: "Ankle sprain", category: "Hip, knee & lower limb" },
  { id: "seed:shin-splints", name: "Shin splints", category: "Hip, knee & lower limb" },

  // Post-surgical
  { id: "seed:post-tkr", name: "Post-op knee replacement (TKR)", category: "Post-surgical" },
  { id: "seed:post-thr", name: "Post-op hip replacement (THR)", category: "Post-surgical" },
  { id: "seed:post-acl", name: "Post-op ACL reconstruction", category: "Post-surgical" },
  { id: "seed:post-spine", name: "Post-op spine surgery", category: "Post-surgical" },
  { id: "seed:post-shoulder", name: "Post-op shoulder surgery", category: "Post-surgical" },
  { id: "seed:post-fracture", name: "Post-fracture rehabilitation", category: "Post-surgical" },

  // Neurological
  { id: "seed:stroke", name: "Stroke (hemiplegia)", category: "Neurological" },
  { id: "seed:parkinsons", name: "Parkinson's disease", category: "Neurological" },
  { id: "seed:bells-palsy", name: "Bell's palsy", category: "Neurological" },
  { id: "seed:peripheral-neuropathy", name: "Peripheral neuropathy", category: "Neurological" },
  { id: "seed:spinal-cord-injury", name: "Spinal cord injury", category: "Neurological" },
  { id: "seed:cerebral-palsy", name: "Cerebral palsy", category: "Neurological" },
  { id: "seed:bppv", name: "Vertigo (BPPV)", category: "Neurological" },

  // Cardiopulmonary
  { id: "seed:copd-rehab", name: "COPD rehabilitation", category: "Cardiopulmonary" },
  { id: "seed:cardiac-rehab", name: "Cardiac rehabilitation", category: "Cardiopulmonary" },
  { id: "seed:post-covid", name: "Post-COVID rehabilitation", category: "Cardiopulmonary" },

  // Women's & paediatric
  { id: "seed:postnatal", name: "Postnatal rehabilitation", category: "Women's & paediatric" },
  { id: "seed:pelvic-floor", name: "Pelvic floor dysfunction", category: "Women's & paediatric" },
  { id: "seed:developmental-delay", name: "Developmental delay", category: "Women's & paediatric" },
  { id: "seed:torticollis", name: "Torticollis", category: "Women's & paediatric" },

  // General
  { id: "seed:rheumatoid-arthritis", name: "Rheumatoid arthritis", category: "General" },
  { id: "seed:osteoporosis", name: "Osteoporosis", category: "General" },
  { id: "seed:fibromyalgia", name: "Fibromyalgia", category: "General" },
  { id: "seed:chronic-pain", name: "Chronic pain", category: "General" },
  { id: "seed:deconditioning", name: "General deconditioning", category: "General" },
  { id: "seed:balance-gait", name: "Balance & gait training", category: "General" },
  { id: "seed:sports-injury", name: "Sports injury (general)", category: "General" },
];
