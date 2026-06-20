import { signInWithMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;
  const message = params.message;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Ecosystem
        </p>
        <h1 className="text-2xl font-semibold text-zinc-950">Sign in</h1>
        <p className="text-sm leading-6 text-zinc-600">
          Use your work email. We&apos;ll send a magic link to finish signing
          in.
        </p>
      </div>

      {error ? (
        <p
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {message === "check_email" ? (
        <p
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Check your inbox for a sign-in link.
        </p>
      ) : null}

      <form action={signInWithMagicLink} className="mt-8 space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-800"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none ring-zinc-950/10 focus:border-zinc-500 focus:ring-2"
            placeholder="you@company.com"
          />
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Send magic link
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Internal access only.
      </p>
    </div>
  );
}
