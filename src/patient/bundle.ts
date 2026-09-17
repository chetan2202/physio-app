// A patient "family" data snapshot (R32) that the admin shares as a QR and a patient device
// receives. A family = the patients sharing a phone number, with their visits and payments.
// Encoded as gzip + base64 so it fits a QR (native CompressionStream — no dependency).

import type { Attendance, Patient, Payment } from "../domain/types.js";

export interface FamilyBundle {
  t: "physio-family";
  v: 1;
  generatedAt: number;
  clinic?: string;
  patients: Patient[];
  attendance: Attendance[];
  payments: Payment[];
}

async function gzip(s: string): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const stream = new Blob([new TextEncoder().encode(s)]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodeFamily(bundle: FamilyBundle): Promise<string> {
  return bytesToB64(await gzip(JSON.stringify(bundle)));
}

export async function decodeFamily(code: string): Promise<FamilyBundle> {
  let bundle: FamilyBundle;
  try {
    bundle = JSON.parse(await gunzip(b64ToBytes(code.trim()))) as FamilyBundle;
  } catch {
    throw new Error("That code could not be read.");
  }
  if (bundle?.t !== "physio-family" || !Array.isArray(bundle.patients)) {
    throw new Error("That is not a Physio family code.");
  }
  return bundle;
}
