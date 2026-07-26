import { getAllAgents } from "@/lib/agents";
import { AgentsGrid } from "@/components/AgentsGrid";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 60;

export default async function AgentsPage() {
  const agents = await getAllAgents();

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <PageHeader
        className="mb-10"
        eyebrow="Discover"
        title={
          <>
            Browse the <span className="accent-text">agent catalogue.</span>
          </>
        }
        description="Every agent listed here has a public track record. Compare strategy, performance, and risk profile before you commit capital."
      />

      <AgentsGrid agents={agents} />
    </div>
  );
}
