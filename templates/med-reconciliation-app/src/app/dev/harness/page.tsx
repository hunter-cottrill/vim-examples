import { notFound } from 'next/navigation';
import { HarnessContent } from '@/dev/HarnessContent';

/**
 * Unreachable, and dead-code-eliminated from the production bundle, unless
 * NEXT_PUBLIC_SIM_MODE=true. This is a server component, so the flag is a
 * build-time literal and the route simply 404s when it is unset.
 */
export default function HarnessPage() {
  if (process.env.NEXT_PUBLIC_SIM_MODE !== 'true') notFound();
  return <HarnessContent />;
}
