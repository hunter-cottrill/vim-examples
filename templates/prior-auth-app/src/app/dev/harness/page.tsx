import { notFound } from 'next/navigation';
import { HarnessContent } from '@/dev/HarnessContent';

const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

export default function HarnessPage() {
  if (!SIM_MODE) notFound();
  return <HarnessContent />;
}
