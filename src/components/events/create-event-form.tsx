"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEventAction } from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatEnumLabel } from "@/lib/format/enum";

const EVENT_TYPES = [
  "dinner",
  "roundtable",
  "workshop",
  "retreat",
  "summit",
  "other",
] as const;

function defaultDateTimeLocalValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function CreateEventForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [eventType, setEventType] = useState<string>("other");

  if (!isOpen) {
    return (
      <Button type="button" onClick={() => setIsOpen(true)}>
        New event
      </Button>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await createEventAction(formData);
          if (result.error) {
            window.alert(result.error);
            return;
          }
          setIsOpen(false);
          if (result.eventId) {
            router.push(`/events/${result.eventId}`);
            return;
          }
          router.refresh();
        });
      }}
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <input type="hidden" name="eventType" value={eventType} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            name="title"
            required
            placeholder="e.g. Founder dinner — March 2026"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-type">Type</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger id="event-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatEnumLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-date">When</Label>
          <Input
            id="event-date"
            name="eventDate"
            type="datetime-local"
            defaultValue={defaultDateTimeLocalValue()}
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="event-location">Location (optional)</Label>
          <Input
            id="event-location"
            name="location"
            placeholder="e.g. London"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="event-description">Description (optional)</Label>
          <Textarea
            id="event-description"
            name="description"
            rows={3}
            placeholder="What happened, who was it for, themes…"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Creating…" : "Create event"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setIsOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
