"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createProfileFromCalendarReviewAction,
  ignoreAllInternalCalendarReviewsAction,
  ignoreCalendarReviewAction,
  linkCalendarReviewAction,
  searchProfilesForCalendarLinkAction,
} from "@/app/(app)/admin/calendar-sync/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CalendarMatchedMeeting,
  CalendarMatchedMeetingLists,
  CalendarReviewGroupLists,
  CalendarSyncReviewSummary,
  CalendarUnmatchedGroup,
} from "@/lib/data/calendar-sync-review";
import { formatInteractionDate } from "@/lib/format/date";

type CalendarSyncReviewWizardProps = {
  summary: CalendarSyncReviewSummary;
  unmatchedGroups: CalendarReviewGroupLists;
  matchedMeetings: CalendarMatchedMeetingLists;
};

function formatMeetingContext(group: CalendarUnmatchedGroup): string {
  if (group.meetingCount === 1 && group.sampleMeetingTitle) {
    return `${group.sampleMeetingTitle}${
      group.sampleMeetingDate
        ? ` · ${formatInteractionDate(group.sampleMeetingDate)}`
        : ""
    }`;
  }

  return `${group.meetingCount} meetings${
    group.sampleMeetingTitle ? ` · e.g. ${group.sampleMeetingTitle}` : ""
  }`;
}

function InternalReviewRow({ group }: { group: CalendarUnmatchedGroup }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-muted/20 px-4 py-3">
      <div>
        <p className="text-body font-medium text-foreground">
          {group.displayName ?? group.email}
        </p>
        <p className="text-caption text-muted-foreground">{group.email}</p>
        <p className="text-caption text-muted-foreground">
          {formatMeetingContext(group)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("email", group.email);
            const result = await ignoreCalendarReviewAction(formData);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        Ignore
      </Button>
      {error ? (
        <p className="text-body text-destructive" role="alert">{error}</p>
      ) : null}
    </div>
  );
}

function UnmatchedReviewRow({ group }: { group: CalendarUnmatchedGroup }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState(group.displayName ?? "");
  const [candidates, setCandidates] = useState<
    Array<{ id: string; fullName: string; email: string | null }>
  >([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );

  async function handleSearch() {
    setError(null);
    const result = await searchProfilesForCalendarLinkAction(linkQuery);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCandidates(result.profiles);
    setSelectedProfileId(result.profiles[0]?.id ?? null);
  }

  function runAction(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-body font-medium text-foreground">
          {group.displayName ?? group.email}
        </p>
        <p className="text-caption text-muted-foreground">{group.email}</p>
        <p className="text-caption text-muted-foreground">
          {formatMeetingContext(group)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("email", group.email);
            formData.set("displayName", group.displayName ?? "");
            runAction(() => createProfileFromCalendarReviewAction(formData));
          }}
        >
          Create profile
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("email", group.email);
            runAction(() => ignoreCalendarReviewAction(formData));
          }}
        >
          Ignore
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-caption text-muted-foreground">Link to existing profile</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={linkQuery}
            onChange={(event) => setLinkQuery(event.target.value)}
            placeholder="Search by name or email"
            className="max-w-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              startTransition(handleSearch);
            }}
          >
            Search
          </Button>
        </div>
        {candidates.length > 0 ? (
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex cursor-pointer items-center gap-2 text-body"
              >
                <input
                  type="radio"
                  name={`profile-${group.email}`}
                  checked={selectedProfileId === candidate.id}
                  onChange={() => setSelectedProfileId(candidate.id)}
                />
                <span>
                  {candidate.fullName}
                  {candidate.email ? ` · ${candidate.email}` : ""}
                </span>
              </label>
            ))}
            <Button
              type="button"
              size="sm"
              disabled={isPending || !selectedProfileId}
              onClick={() => {
                if (!selectedProfileId) {
                  return;
                }
                const formData = new FormData();
                formData.set("email", group.email);
                formData.set("profileId", selectedProfileId);
                runAction(() => linkCalendarReviewAction(formData));
              }}
            >
              Link selected profile
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TeamReviewSection({ groups }: { groups: CalendarUnmatchedGroup[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (groups.length === 0) {
    return null;
  }

  return (
    <details className="rounded-lg border border-border bg-muted/20 p-4">
      <summary className="cursor-pointer text-body font-medium text-foreground">
        PU team ({groups.length})
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-body text-muted-foreground">
          Internal addresses from before the filter was applied. Ignore to clear
          the queue — future syncs skip them automatically.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await ignoreAllInternalCalendarReviewsAction();
              if (result.error) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          Ignore all team
        </Button>
        <div className="space-y-2">
          {groups.map((group) => (
            <InternalReviewRow key={group.email} group={group} />
          ))}
        </div>
        {error ? (
          <p className="text-body text-destructive" role="alert">{error}</p>
        ) : null}
      </div>
    </details>
  );
}

function MatchedMeetingsTable({ meetings }: { meetings: CalendarMatchedMeeting[] }) {
  if (meetings.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        No meeting activities in this section.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-body">
        <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Meeting</th>
            <th className="px-4 py-3 font-medium">Profile</th>
            <th className="px-4 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => (
            <tr key={meeting.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{meeting.title}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/profiles/${meeting.profileId}`}
                  className="hover:underline"
                >
                  {meeting.profileName}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatInteractionDate(meeting.activityDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarSyncReviewWizard({
  summary,
  unmatchedGroups,
  matchedMeetings,
}: CalendarSyncReviewWizardProps) {
  const defaultTab =
    summary.pendingReviewCount > 0 ? "review" : "matched";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="review">
          Review people ({summary.pendingReviewCount})
        </TabsTrigger>
        <TabsTrigger value="matched">
          Matched meetings ({summary.matchedMeetingCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-4">
        {summary.syncing ? (
          <p className="rounded-lg border border-border bg-card p-4 text-body text-foreground">
            Sync is still running in the background. Refresh this page in a
            minute to see updated results.
          </p>
        ) : null}

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Calendar</dt>
            <dd className="text-subheading font-medium">
              {summary.accountEmail ?? "Not connected"}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Meetings pulled</dt>
            <dd className="text-subheading font-medium">
              {summary.eventsProcessed}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">
              External profiles matched
            </dt>
            <dd className="text-subheading font-medium">
              {summary.matchedMeetingCount}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Need review</dt>
            <dd className="text-subheading font-medium">
              {summary.pendingReviewCount}
            </dd>
          </div>
        </dl>

        {summary.internalPendingReviewCount > 0 ||
        summary.internalMatchedMeetingCount > 0 ? (
          <p className="text-caption text-muted-foreground">
            {summary.internalPendingReviewCount > 0
              ? `${summary.internalPendingReviewCount} PU team addresses are in the review queue (see collapsed section on Review people). `
              : ""}
            {summary.internalMatchedMeetingCount > 0
              ? `${summary.internalMatchedMeetingCount} matched meetings are on internal profiles (see Matched meetings tab).`
              : ""}
          </p>
        ) : null}

        <p className="text-body text-muted-foreground">
          {summary.pendingReviewCount > 0
            ? "Work through external meeting attendees in the Review people tab. Create a profile, link to someone you already know, or ignore no-replies and vendors."
            : "Everything external from this sync is matched. Check matched meetings or return to Admin."}
        </p>
      </TabsContent>

      <TabsContent value="review" id="review-tab" className="space-y-4">
        {unmatchedGroups.external.length === 0 ? (
          <p className="text-body text-muted-foreground">
            No external attendees left in the queue.
          </p>
        ) : (
          <>
            <p className="text-body text-muted-foreground">
              Showing {unmatchedGroups.external.length} people grouped by email.
              Actions apply across all their pending meetings.
            </p>
            <div className="space-y-4">
              {unmatchedGroups.external.map((group) => (
                <UnmatchedReviewRow key={group.email} group={group} />
              ))}
            </div>
          </>
        )}

        <TeamReviewSection groups={unmatchedGroups.internal} />
      </TabsContent>

      <TabsContent value="matched" className="space-y-4">
        {matchedMeetings.external.length === 0 &&
        matchedMeetings.internal.length === 0 ? (
          <p className="text-body text-muted-foreground">
            No meeting activities were created yet.
          </p>
        ) : (
          <>
            <MatchedMeetingsTable meetings={matchedMeetings.external} />
            {matchedMeetings.internal.length > 0 ? (
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer text-body font-medium text-foreground">
                  PU team profiles ({matchedMeetings.internal.length})
                </summary>
                <div className="mt-4 space-y-3">
                  <p className="text-body text-muted-foreground">
                    Meetings matched to internal addresses from earlier syncs.
                    These are not part of the external relationship graph.
                  </p>
                  <MatchedMeetingsTable meetings={matchedMeetings.internal} />
                </div>
              </details>
            ) : null}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
