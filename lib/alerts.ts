import { Resend } from "resend";
import { AgentEntry } from "./types";

export async function alertDead(agents: AgentEntry[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!apiKey || !to || agents.length === 0) return;

  const resend = new Resend(apiKey);

  const lines = agents
    .map(
      (a) =>
        `• ${a.name} (${a.project || "no project"}) — schedule: ${a.schedule}, last seen: ${a.lastPing}`
    )
    .join("\n");

  const dashboardUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "your dashboard";

  await resend.emails.send({
    from: "Agent Ops <onboarding@resend.dev>",
    to,
    subject: `[Agent Ops] ${agents.length} agent(s) went dead`,
    text: `The following agents missed their heartbeat and are now marked dead:\n\n${lines}\n\nDashboard: ${dashboardUrl}`,
  });
}
