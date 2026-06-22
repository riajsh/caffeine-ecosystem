"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createProfileFromCalendarReviewAction,
  ignoreAllInternalCalendarReviewsAction,
  ignoreCalendarReviewAction,
  linkCalendarReviewAction,
  searchProfilesForCalendarLinkAction,
} from "@/app/(app)/admin/calendar-sync/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CalendarMatchedMeeting,
  CalendarMatchedMeetingLists,
  CalendarProfileMatch,
  CalendarReviewGroupLists,
  CalendarSyncReviewSummary,
  CalendarUnmatchedGroup,
} from "@/lib/data/calendar-sync-review";
import { formatInteractionDate } from "@/lib/format/date";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

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
  const { isPending, run } = useAsyncAction();
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
          void run(async () => {
            setError(null);
            const formData = new FormData();
            formData.set("email", group.email);
            const result = await ignoreCalendarReviewAction(formData);
            if (result.error) {
              setError(result.error);
              return;
            }
            toastSuccess("Review ignored");
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
  const { isPending, run } = useAsyncAction();
  const [error, setError] = useState<string | null>(null);
  const initialQuery = group.displayName?.trim() || group.email;
  const [linkQuery, setLinkQuery] = useState(initialQuery);
  const [organisationName, setOrganisationName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [candidates, setCandidates] = useState<CalendarProfileMatch[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const isFirstSearch = useRef(true);

  const runSearch = useCallback(
    async (query: string, signal?: AbortSignal) => {
      setIsSearching(true);
      setError(null);

      const result = await searchProfilesForCalendarLinkAction(
        query,
        group.email,
      );

      if (signal?.aborted) {
        return;
      }

      setIsSearching(false);
      setHasSearched(true);

      if (result.error) {
        setError(result.error);
        setCandidates([]);
        setSelectedProfileId(null);
        return;
      }

      setCandidates(result.profiles);
      const exactMatch = result.profiles.find(
        (profile) => profile.matchReason === "exact_email",
      );
      setSelectedProfileId(exactMatch?.id ?? result.profiles[0]?.id ?? null);
    },
    [group.email],
  );

  useEffect(() => {
    const abortController = new AbortController();
    const delay = isFirstSearch.current ? 0 : 300;
    isFirstSearch.current = false;

    const timer = window.setTimeout(() => {
      void runSearch(linkQuery, abortController.signal);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [linkQuery, runSearch]);

  function runAction(
    action: () => Promise<{ error?: string }>,
    successMessage: string,
  ) {
    void run(async () => {
      setError(null);
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      toastSuccess(successMessage);
      router.refresh();
    });
  }

  const selectedProfile = candidates.find(
    (candidate) => candidate.id === selectedProfileId,
  );

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Not in Ecosystem</Badge>
          <span className="text-caption text-muted-foreground">
            {group.meetingCount}{" "}
            {group.meetingCount === 1 ? "meeting" : "meetings"}
          </span>
        </div>
        <p className="text-body font-medium text-foreground">{group.email}</p>
        {group.displayName ? (
          <p className="text-caption text-muted-foreground">
            Name on Google Calendar: {group.displayName}
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground">
          {formatMeetingContext(group)}
        </p>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
        <div>
          <p className="text-body font-medium text-foreground">
            Create new profile
          </p>
          <p className="text-caption text-muted-foreground">
            Add company and role now if you know them — saves triage later.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={organisationName}
            onChange={(event) => setOrganisationName(event.target.value)}
            placeholder="Company"
            aria-label={`Company for ${group.email}`}
          />
          <Input
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
            placeholder="Role / title"
            aria-label={`Role for ${group.email}`}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
        <div>
          <p className="text-body font-medium text-foreground">
            Link to an existing profile
          </p>
          <p className="text-caption text-muted-foreground">
            Search by name or email. We check for an exact email match
            automatically.
          </p>
        </div>

        <Input
          value={linkQuery}
          onChange={(event) => setLinkQuery(event.target.value)}
          placeholder="Search profiles…"
          aria-label={`Search profiles to link ${group.email}`}
        />

        {isSearching ? (
          <p className="text-caption text-muted-foreground">Searching…</p>
        ) : null}

        {!isSearching && candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-caption font-medium text-muted-foreground">
              {candidates.some((c) => c.matchReason === "exact_email")
                ? "Suggested match"
                : "Possible matches"}
            </p>
            <div className="space-y-2">
              {candidates.map((candidate) => {
                const isSelected = selectedProfileId === candidate.id;

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedProfileId(candidate.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body font-medium text-foreground">
                        {candidate.fullName}
                      </p>
                      {candidate.matchReason === "exact_email" ? (
                        <Badge variant="secondary">Same email</Badge>
                      ) : null}
                    </div>
                    {candidate.email ? (
                      <p className="text-caption text-muted-foreground">
                        {candidate.email}
                      </p>
                    ) : (
                      <p className="text-caption text-muted-foreground">
                        No email on profile
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
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
                  runAction(
                    () => linkCalendarReviewAction(formData),
                    `Linked to ${selectedProfile?.fullName ?? "profile"}`,
                  );
                }}
              >
                Link to {selectedProfile?.fullName ?? "selected profile"}
              </Button>
              {selectedProfile ? (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/profiles/${selectedProfile.id}`} target="_blank">
                    Preview profile
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isSearching && hasSearched && candidates.length === 0 ? (
          <p className="text-body text-muted-foreground">
            No matching profiles found. Create a new profile below, or refine
            your search.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("email", group.email);
            formData.set("displayName", group.displayName ?? "");
            formData.set("organisationName", organisationName);
            formData.set("occupation", occupation);
            runAction(
              () => createProfileFromCalendarReviewAction(formData),
              "Profile created",
            );
          }}
        >
          Create new profile
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            const formData = new FormData();
            formData.set("email", group.email);
            runAction(
              () => ignoreCalendarReviewAction(formData),
              "Review ignored",
            );
          }}
        >
          Ignore
        </Button>
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
  const { isPending, run } = useAsyncAction();
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
            void run(async () => {
              setError(null);
              const result = await ignoreAllInternalCalendarReviewsAction();
              if (result.error) {
                setError(result.error);
                return;
              }
              toastSuccess("Team reviews ignored");
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
            ? "Work through external attendees who still need a decision — typically people with only a first name or no name on Google Calendar. Link to someone you already know, create a profile, or ignore no-replies and vendors."
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
              Each card is someone Google Calendar listed on a meeting who is not
              yet in Ecosystem and could not be added automatically (missing a
              full name). Link them to an existing profile, create a new one, or
              ignore vendors and no-replies.
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
