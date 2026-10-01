import { SIM_MODE } from '@/lib/vim-client';

/** Visible whenever the simulator is on, so it's never mistaken for a live EHR. */
export function SimBanner() {
  if (!SIM_MODE) return null;
  return (
    <div role="status" className="sim-banner">
      <span className="dot" aria-hidden />
      <span className="sim-banner-text">
        <span><strong>Simulator on</strong> — sample data, not a live EHR.</span>
        <span className="sim-banner-detail">To connect to the sandbox, set <code>NEXT_PUBLIC_SIM_MODE=false</code> and restart.</span>
      </span>
    </div>
  );
}
