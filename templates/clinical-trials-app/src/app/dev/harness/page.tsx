import { notFound } from 'next/navigation';
import { HarnessContent } from '@/dev/HarnessContent';

// Unreachable and dead-code-eliminated from the production bundle unless
// NEXT_PUBLIC_SIM_MODE=true. Proves the app handles chart_open correctly —
// not that chart_open fires in a live EHR.
export default function HarnessPage() {
  if (process.env.NEXT_PUBLIC_SIM_MODE !== 'true') notFound();
  return <HarnessContent />;
}
