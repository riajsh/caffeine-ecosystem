import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { signInWithMagicLink, signInWithPassword } from "./actions";

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
  const showSeedHint = process.env.NODE_ENV === "development";

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <div className="space-y-2">
        <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
          Ecosystem
        </p>
        <h1 className="text-display font-medium text-foreground">Sign in</h1>
        <p className="text-body text-muted-foreground">
          Internal access only. Sign in with your work account.
        </p>
      </div>

      {error ? (
        <p
          className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-body text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {message === "check_email" ? (
        <p
          className="mt-6 rounded-lg border border-border bg-muted px-4 py-3 text-body text-foreground"
          role="status"
        >
          Check your inbox for a sign-in link.
        </p>
      ) : null}

      {showSeedHint ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-caption text-muted-foreground">
          Seed account: <span className="font-medium">james@seed.test</span> /
          password <span className="font-medium">password123</span>
        </p>
      ) : null}

      <form action={signInWithPassword} className="mt-8 space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-caption font-medium text-foreground"
          >
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="james@seed.test"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-caption font-medium text-foreground"
          >
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-caption text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithMagicLink} className="space-y-4">
        <p className="text-caption text-muted-foreground">
          Magic links are rate-limited. Use password sign-in if you hit the
          cooldown.
        </p>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          aria-label="Email for magic link"
        />
        <Button type="submit" variant="outline" className="w-full">
          Send magic link
        </Button>
      </form>
    </div>
  );
}
