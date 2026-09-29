import { notFound } from 'next/navigation';
import { HarnessContent } from './HarnessContent';

/** DEV-ONLY. Unreachable unless NEXT_PUBLIC_SIM_MODE=true. */
export default function HarnessPage() {
  if (process.env.NEXT_PUBLIC_SIM_MODE !== 'true') notFound();
  return <HarnessContent />;
}
