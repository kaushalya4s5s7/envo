import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

/**
 * Authentication.
 *
 * Google is offered whenever `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
 * set. Email sign in is offered always, Google or no Google — not everyone
 * signing in has a Google account, and this account system (orgs, invites,
 * roles) has to be reachable by anyone with an email address, not just a
 * Google one.
 *
 * The email path is **not verified**. It accepts any well formed address and
 * grants a session for it — no password, no magic link. That is a real gap:
 * anyone who knows an address can sign in as it. The sign in screen says so
 * in plain words rather than implying otherwise. There is deliberately no
 * imitation Google button anywhere — a counterfeit of somebody else's sign
 * in flow is dishonest to whoever is watching.
 *
 * Sessions are JWT only. See docs/decisions/product/dashboard-and-auth.md for
 * why a real, verified email path (magic link) is the intended next step.
 */

const googleConfigured = Boolean(
  process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET'],
);

export const GOOGLE_ENABLED = googleConfigured;

const config: NextAuthConfig = {
  providers: [
    /**
     * Credentials are passed explicitly. Auth.js v5 infers them from
     * `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` by convention, so registering
     * `Google` bare against `GOOGLE_CLIENT_ID` sends `client_id=undefined` to
     * Google — the redirect still lands on accounts.google.com and fails there,
     * which is why it has to be checked at the URL rather than at the button.
     */
    ...(googleConfigured
      ? [Google({
          clientId: process.env['GOOGLE_CLIENT_ID']!,
          clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
        })]
      : []),
    /**
     * Always registered, Google or no Google. Accepts any well formed email
     * and grants a session for it — verifies nothing. See the file header.
     */
    Credentials({
      id: 'demo',
      name: 'Email',
      credentials: { email: { label: 'Email', type: 'email' } },
      authorize: (raw) => {
        const email = typeof raw?.['email'] === 'string' ? raw['email'].trim() : '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
        return { id: email, email, name: email.split('@')[0] ?? 'Operator' };
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
