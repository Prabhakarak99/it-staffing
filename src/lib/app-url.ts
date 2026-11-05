/**
 * The public site address (NEXT_PUBLIC_APP_URL). Use it for redirects from route handlers:
 * behind Fly's proxy req.url is the internal http://localhost:3000.
 */
export function appOrigin() {
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
}
