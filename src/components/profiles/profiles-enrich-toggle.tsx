"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { FilterChipLink } from "@/components/filters/filter-chips";

type ProfilesEnrichToggleProps = {
  isActive: boolean;
};

export function ProfilesEnrichToggle({ isActive }: ProfilesEnrichToggleProps) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());

  if (isActive) {
    params.delete("enrich");
  } else {
    params.set("enrich", "1");
  }

  const href = params.toString() ? `/profiles?${params.toString()}` : "/profiles";

  return (
    <FilterChipLink href={href} isActive={isActive}>
      Enrich mode
    </FilterChipLink>
  );
}

export function ProfilesEnrichModeHint() {
  return (
    <p className="text-caption text-muted-foreground">
      Enrich mode shows suggested company and owner on empty fields — click to
      edit or confirm. Pair with{" "}
      <Link href="/profiles?complete=missing-company&enrich=1" className="text-interactive-primary hover:underline">
        Missing company
      </Link>{" "}
      to triage faster.
    </p>
  );
}
