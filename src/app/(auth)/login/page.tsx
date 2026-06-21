import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { getPrimaryLoginDomain } from "@/lib/auth/allowed-email";
import { formatLoginError } from "@/lib/auth/login-errors";

import { signInWithGoogle, signInWithPassword } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error ? formatLoginError(params.error) : undefined;
  const showSeedHint = process.env.NODE_ENV === "development";
  const primaryDomain = getPrimaryLoginDomain();

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <div className="space-y-2">
        <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
          Ecosystem
        </p>
        <h1 className="text-display font-medium text-foreground">Sign in</h1>
        <p className="text-body text-muted-foreground">
          Internal access only.
          {primaryDomain
            ? ` Use your @${primaryDomain} Google account.`
            : " Sign in with your work Google account."}
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

      {showSeedHint ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-caption text-muted-foreground">
          Seed account: <span className="font-medium">ce@previously.co</span> /
          password <span className="font-medium">password123</span>
        </p>
      ) : null}

      <form action={signInWithGoogle} className="mt-8">
        <input type="hidden" name="next" value={params.next ?? ""} />
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>

      {showSeedHint ? (
        <>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-caption text-muted-foreground">
              local dev only
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={signInWithPassword} className="space-y-4">
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
                placeholder="ce@previously.co"
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
                placeholder="Your password"
              />
            </div>

            <Button type="submit" variant="outline" className="w-full">
              Sign in with password
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
