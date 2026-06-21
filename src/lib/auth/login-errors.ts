const MAGIC_LINK_RATE_LIMIT_PATTERN =
  /rate limit|too many requests|over_email_send_rate_limit/i;

export function isMagicLinkRateLimitError(message: string): boolean {
  return MAGIC_LINK_RATE_LIMIT_PATTERN.test(message);
}

export function formatLoginError(message: string): string {
  if (message === "missing_email") {
    return "Enter your email address for the magic link.";
  }

  if (isMagicLinkRateLimitError(message)) {
    return "Too many magic-link requests. Wait a few minutes, or sign in with your password above.";
  }

  if (/invalid login credentials/i.test(message)) {
    return "Email or password is incorrect.";
  }

  return message;
}
