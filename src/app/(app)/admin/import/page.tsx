import { redirect } from "next/navigation";

export default function ImportListRedirectPage() {
  redirect("/admin/datasets");
}
