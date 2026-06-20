"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteTagAction } from "@/app/(app)/admin/tags/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrgTag } from "@/lib/data/tags";
import { formatEnumLabel } from "@/lib/format/enum";

type TagsTableProps = {
  tags: OrgTag[];
};

export function TagsTable({ tags }: TagsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
        <p className="text-subheading font-medium text-foreground">No tags yet</p>
        <p className="mt-2 text-body text-muted-foreground">
          Create sector, role, and interest tags to classify profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Profiles</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag) => (
            <TableRow key={tag.id}>
              <TableCell className="font-medium text-foreground">{tag.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatEnumLabel(tag.category)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {tag.profileCount}
              </TableCell>
              <TableCell>
                <form
                  action={(formData) => {
                    if (
                      !window.confirm(
                        `Delete tag "${tag.name}"? It will be removed from all profiles.`,
                      )
                    ) {
                      return;
                    }

                    startTransition(async () => {
                      const result = await deleteTagAction(formData);
                      if (result.error) {
                        window.alert(result.error);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  <input type="hidden" name="tagId" value={tag.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
