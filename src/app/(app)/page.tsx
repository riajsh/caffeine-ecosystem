import { requireUser } from "@/lib/auth/session";

import { signOut } from "../(auth)/login/actions";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Ecosystem
        </p>
        <h1 className="text-3xl font-semibold text-zinc-950">
          Signed in as {user.full_name}
        </h1>
        <p className="text-sm text-zinc-600">
          {user.email} · {user.role}
        </p>
      </div>

      <p className="max-w-xl text-base leading-7 text-zinc-600">
        Auth, org scoping, and session bootstrap are wired up. Feature screens
        come next.
      </p>

      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
