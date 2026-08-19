"use client";

import { useState } from "react";
import type { SdohInsight } from "@/lib/sdoh-rules";
import type { WritebackOutcome } from "@/lib/vim-client";

// CONCEPT: the panel is the human-in-the-loop gate. It renders each insight, lets the
// provider CHECK the Z-codes they agree with, and a single button triggers the gated
// writeback. Nothing writes without an explicit selection.
export function SdohPanel({
  insights,
  onWriteback,
}: {
  insights: SdohInsight[];
  onWriteback: (codes: Array<{ code: string; description: string }>) => Promise<WritebackOutcome>;
}) {
  if (insights.length === 0) {
    return <p style={{ color: "#666" }}>No social needs detected yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onWriteback={onWriteback} />
      ))}
    </div>
  );
}

function InsightCard({
  insight,
  onWriteback,
}: {
  insight: SdohInsight;
  onWriteback: (codes: Array<{ code: string; description: string }>) => Promise<WritebackOutcome>;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string>("");
  const [writing, setWriting] = useState(false);

  const chosen = insight.suggestedZCodes.filter((z) => selected[z.code]);

  async function write() {
    setWriting(true);
    try {
      const outcome = await onWriteback(chosen);
      setStatus(outcome.ok ? "Added to encounter." : `Not added: ${outcome.reason}`);
    } finally {
      setWriting(false);
    }
  }

  const showWriteback = insight.suggestedZCodes.length > 0 && !insight.alreadyDocumented;

  return (
    <section style={{ border: "1px solid #e2e2e2", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong>{insight.title}</strong>
        <span
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            background: insight.evidenceStrength === "confirmed-data" ? "#e6f4ea" : "#fef7e0",
            color: insight.evidenceStrength === "confirmed-data" ? "#1e7e34" : "#8a6d00",
          }}
        >
          {insight.evidenceStrength === "confirmed-data" ? "Confirmed" : "Suspected"}
        </span>
      </div>

      <ul style={{ fontSize: 13, color: "#444", margin: "6px 0" }}>
        {insight.evidence.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>Resource: {insight.resourceType}</p>

      {insight.alreadyDocumented && (
        <p style={{ fontSize: 12, color: "#888", margin: "4px 0" }}>Already documented on chart.</p>
      )}

      {showWriteback && (
        <div style={{ marginTop: 8 }}>
          {insight.suggestedZCodes.map((z) => (
            <label key={z.code} style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={!!selected[z.code]}
                onChange={(e) => setSelected((s) => ({ ...s, [z.code]: e.target.checked }))}
              />{" "}
              {z.code} — {z.description}
            </label>
          ))}
          <button disabled={chosen.length === 0 || writing} onClick={write} style={{ marginTop: 6 }}>
            {writing ? "Adding…" : "Add to encounter"}
          </button>
          {status && <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{status}</p>}
        </div>
      )}
    </section>
  );
}
