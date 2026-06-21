import { PageHeader } from "@/components/app-shell/page-header";

export default function ConnectSettingsPage() {
  return (
    <>
      <PageHeader
        title="Connect Settings"
        description={`Controls for the auto-surfaced "Who to reconnect with" sections.`}
      />
      <div className="space-y-6 px-8 py-6">
        <section className="max-w-lg space-y-3 rounded-lg border border-border bg-card p-5">
          <label className="block space-y-1 text-body">
            <span className="text-label text-muted-foreground">
              Dismiss duration
            </span>
            <span className="block text-caption text-muted-foreground">
              How long a dismissed profile stays hidden before resurfacing
              automatically.
            </span>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="number"
                defaultValue={30}
                disabled
                className="w-24 rounded-md border border-border bg-muted/30 px-3 py-2"
              />
              <span className="text-body text-muted-foreground">days</span>
            </div>
          </label>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card p-5">
          <h2 className="text-subheading font-medium text-foreground">
            Active dismissals
          </h2>
          <p className="text-body text-muted-foreground">
            0 profiles currently dismissed across the team
          </p>
          <p className="text-caption text-muted-foreground">
            Connect dismissals ship with Phase 2 Connect. No schema for this in
            V1 yet.
          </p>
        </section>
      </div>
    </>
  );
}
