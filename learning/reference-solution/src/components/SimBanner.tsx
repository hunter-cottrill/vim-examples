import { SIM_MODE } from '@/lib/vim-client';

/** Visible whenever the simulator is on, so it's never mistaken for a live EHR. */
export function SimBanner() {
  if (!SIM_MODE) return null;
  return (
    <div role="status" style={{ background: '#fff4ce', border: '1px solid #e0c060', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
      <strong>Simulator on.</strong> Showing sample data, not a live EHR. Set <code>NEXT_PUBLIC_SIM_MODE=false</code> and restart to connect to the sandbox.
    </div>
  );
}
