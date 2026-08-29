import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

/**
 * Authentication.
 *
 * Real Google OAuth when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
 * Without them the provider is not registered at all, and a clearly labelled
 * demo sign in is offered instead.
 *
 * There is deliberately no imitation Google button on the fallback path. A
 * counterfeit of somebody else's sign in flow is dishonest to whoever is
 * watching, and it is exactly the kind of thing a careful investor checks.
 *
 * Sessions are JWT only. There is no user database yet — see
 * docs/decisions/product/dashboard-and-auth.md, which records why persistence
 * is a later phase and says so on the screen rather than faking it.
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
     * Only offered when real OAuth is absent. Once Google is configured this
     * disappears, so there is no "any email works" door left open behind it.
     */
    ...(googleConfigured ? [] : [Credentials({
      id: 'demo',
      name: 'Demo access',
      credentials: { email: { label: 'Work email', type: 'email' } },
      /**
       * Accepts any well formed email and grants a demo session. It verifies
       * nothing, which is why the sign in screen says so in plain words.
       */
      authorize: (raw) => {
        const email = typeof raw?.['email'] === 'string' ? raw['email'].trim() : '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
        return { id: email, email, name: email.split('@')[0] ?? 'Operator' };
      },
    })]),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
