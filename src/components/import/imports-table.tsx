import Link from "next/link";

import { ImportDeleteButton } from "@/components/import/import-delete-button";
import { ImportStatusBadge } from "@/components/import/import-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInteractionDate } from "@/lib/format/date";
import type { ImportListItem } from "@/lib/import/types";

type ImportsTableProps = {
  imports: ImportListItem[];
};

export function ImportsTable({ imports }: ImportsTableProps) {
  if (imports.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
        <p className="text-subheading font-medium text-foreground">
          No imports yet
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Upload a CSV to start bringing external contacts into the graph.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Rows</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Next step</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>By</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/admin/import/${item.id}`}
                  className="text-foreground hover:underline"
                >
                  {item.filename}
                </Link>
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {item.source}
              </TableCell>
              <TableCell>{item.rowCount}</TableCell>
              <TableCell>
                <ImportStatusBadge status={item.status} />
              </TableCell>
              <TableCell className="max-w-[220px] text-muted-foreground">
                {item.statusHint}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatInteractionDate(item.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.createdByName}
              </TableCell>
              <TableCell>
                {item.canDelete ? (
                  <ImportDeleteButton importId={item.id} filename={item.filename} />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
