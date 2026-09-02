'use client';

import { notFound } from 'next/navigation';
import HarnessContent from '@/dev/HarnessContent';

// NEXT_PUBLIC_* vars are inlined as build-time literal constants by Next.js. With
// the flag unset (the default), this route 404s immediately and HarnessContent
// never renders. This route is standalone — nothing else in the app imports it or
// src/dev/HarnessContent.tsx/fixtures.ts, so this import is scoped entirely to
// this one dev-only route.
const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

export default function DevHarnessPage() {
  if (!SIM_MODE) notFound();
  return <HarnessContent />;
}