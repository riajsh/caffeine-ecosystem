import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { OrbitRadial } from "@/components/orbit/orbit-radial";
import { OrbitView } from "@/components/orbit/orbit-view";
import { OwnerDot } from "@/components/profiles/owner-dot";
import { getOrbitNodes } from "@/lib/computed/orbit";
import { listOrgUsers } from "@/lib/data/users";

type OrbitPageProps = {
  searchParams: Promise<{ owner?: string; view?: string }>;
};

function buildOrbitHref(owner?: string, view?: string) {
  const params = new URLSearchParams();
  if (owner) {
    params.set("owner", owner);
  }
  if (view && view !== "radial") {
    params.set("view", view);
  }
  const query = params.toString();
  return query ? `/orbit?${query}` : "/orbit";
}

export default async function OrbitPage({ searchParams }: OrbitPageProps) {
  const { owner: ownerUserId, view } = await searchParams;
  const teamUsers = await listOrgUsers();
  const listView = view === "list";

  if (ownerUserId && !/^[0-9a-f-]{36}$/i.test(ownerUserId)) {
    notFound();
  }

  const nodes = await getOrbitNodes(
    ownerUserId ? { ownerUserId } : undefined,
  );

  return (
    <>
      <PageHeader
        title="Orbit"
        description="Relationship strength and recency as distance from centre — colour by primary owner."
      />
      <div className="space-y-6 px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-muted-foreground">Owner:</span>
            <Link
              href={buildOrbitHref(undefined, listView ? "list" : undefined)}
              className={`rounded-full border px-3 py-1 text-caption ${
                !ownerUserId
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              }`}
            >
              All
            </Link>
            {teamUsers.map((user) => (
              <Link
                key={user.id}
                href={buildOrbitHref(user.id, listView ? "list" : undefined)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption ${
                  ownerUserId === user.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground"
                }`}
              >
                <OwnerDot userId={user.id} />
                {user.fullName}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={buildOrbitHref(ownerUserId, undefined)}
              className={`rounded-md border px-3 py-1 text-caption ${
                !listView
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              }`}
            >
              Radial
            </Link>
            <Link
              href={buildOrbitHref(ownerUserId, "list")}
              className={`rounded-md border px-3 py-1 text-caption ${
                listView
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground"
              }`}
            >
              List
            </Link>
          </div>
        </div>
        {listView ? <OrbitView nodes={nodes} /> : <OrbitRadial nodes={nodes} />}
      </div>
    </>
  );
}
