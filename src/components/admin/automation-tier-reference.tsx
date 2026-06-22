type AutomationTierReferenceProps = {
  variant?: "compact" | "full";
};

const TIERS = [
  {
    id: "A",
    label: "Auto — no wait",
    examples:
      "Past meetings on matched profiles, named attendees auto-added, exact email links",
  },
  {
    id: "B",
    label: "Auto-enrich — labelled",
    examples: "Generated summaries, company hints — never overwrites your edits",
  },
  {
    id: "C",
    label: "You decide — async",
    examples:
      "New people, fuzzy links, connections, owners, tags — this review queue",
  },
  {
    id: "D",
    label: "Never automatic",
    examples: "Scores, ownership from sync, silent profile overwrites",
  },
] as const;

export function AutomationTierReference({
  variant = "full",
}: AutomationTierReferenceProps) {
  if (variant === "compact") {
    return (
      <p className="text-caption text-muted-foreground">
        Sync never waits on you for matched meetings. Review queues are Tier C
        backlog only. Policy:{" "}
        <code className="text-caption">docs/decisions/0010-automation-boundaries.md</code>
      </p>
    );
  }

  return (
    <details className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
      <summary className="cursor-pointer text-body font-medium text-foreground">
        What syncs automatically vs what needs you
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-body text-muted-foreground">
          Capture runs at full speed. Review queues are backlog — not gates.
          Timelines and Overview update before you open this page.
        </p>
        <ul className="space-y-3">
          {TIERS.map((tier) => (
            <li key={tier.id} className="text-body">
              <span className="font-medium text-foreground">
                Tier {tier.id} — {tier.label}
              </span>
              <span className="text-muted-foreground"> · {tier.examples}</span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-muted-foreground">
          Full policy:{" "}
          <code className="text-caption">docs/decisions/0010-automation-boundaries.md</code>
        </p>
      </div>
    </details>
  );
}
