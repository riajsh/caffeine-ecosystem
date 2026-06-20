import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SearchFormProps = {
  defaultQuery?: string;
  action?: string;
  preserveParams?: {
    tag?: string;
    owner?: string;
    status?: string;
  };
};

export function SearchForm({
  defaultQuery = "",
  action = "/search",
  preserveParams,
}: SearchFormProps) {
  return (
    <form action={action} method="get" className="flex w-full gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="Search people, companies, activity, events, email…"
        className="flex-1"
        autoComplete="off"
      />
      {preserveParams?.tag ? (
        <input type="hidden" name="tag" value={preserveParams.tag} />
      ) : null}
      {preserveParams?.owner ? (
        <input type="hidden" name="owner" value={preserveParams.owner} />
      ) : null}
      {preserveParams?.status ? (
        <input type="hidden" name="status" value={preserveParams.status} />
      ) : null}
      <Button type="submit">Search</Button>
    </form>
  );
}
