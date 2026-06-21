"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addEventAttendeeAction,
  searchProfilesForPickerAction,
} from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfilePickerOption } from "@/lib/data/profiles";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

type AddEventAttendeeFormProps = {
  eventId: string;
  existingProfileIds: string[];
};

export function AddEventAttendeeForm({
  eventId,
  existingProfileIds,
}: AddEventAttendeeFormProps) {
  const router = useRouter();
  const { alert } = useAppDialog();
  const { isPending: isSubmitting, run: runSubmit } = useAsyncAction();
  const { isPending: isSearching, run: runSearch } = useAsyncAction();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfilePickerOption[]>([]);
  const [selectedProfile, setSelectedProfile] =
    useState<ProfilePickerOption | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedProfile(null);

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      void runSearch(async () => {
        const response = await searchProfilesForPickerAction(value);
        if (response.error) {
          await alert({
            title: "Search failed",
            description: response.error,
          });
          return;
        }

        setResults(
          response.results.filter(
            (profile) => !existingProfileIds.includes(profile.id),
          ),
        );
      });
    }, 250);
  }

  return (
    <form
      action={(formData) => {
        void runSubmit(async () => {
          if (!selectedProfile) {
            await alert({
              title: "Select a profile",
              description: "Choose someone from the search results before adding them as an attendee.",
            });
            return;
          }

          const result = await addEventAttendeeAction(formData);
          if (result.error) {
            await alert({ title: "Could not add attendee", description: result.error });
            return;
          }
          toastSuccess("Attendee added");
          setQuery("");
          setResults([]);
          setSelectedProfile(null);
          router.refresh();
        });
      }}
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <p className="text-subheading font-medium text-foreground">Add attendee</p>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="profileId" value={selectedProfile?.id ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="attendee-search">Search profiles</Label>
        <Input
          id="attendee-search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Name, company, or email…"
          autoComplete="off"
        />
      </div>

      {selectedProfile ? (
        <p className="text-body text-foreground">
          Selected:{" "}
          <span className="font-medium">{selectedProfile.fullName}</span>
          {selectedProfile.organisationName
            ? ` · ${selectedProfile.organisationName}`
            : ""}
        </p>
      ) : null}

      {results.length > 0 && !selectedProfile ? (
        <ul className="max-h-48 overflow-auto rounded-md border border-border">
          {results.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted/50"
                onClick={() => {
                  setSelectedProfile(profile);
                  setResults([]);
                }}
              >
                <span className="text-body font-medium text-foreground">
                  {profile.fullName}
                </span>
                {profile.organisationName ? (
                  <span className="text-caption text-muted-foreground">
                    {profile.organisationName}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="submit"
        disabled={isSubmitting || isSearching || !selectedProfile}
        className="w-fit"
      >
        {isSubmitting ? "Adding…" : "Add attendee"}
      </Button>
    </form>
  );
}
