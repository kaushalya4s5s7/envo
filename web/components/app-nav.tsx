import { auth } from '@/auth';
import { IslandNav } from './island-nav';

/**
 * The signed in navigation, with the account it belongs to.
 *
 * Showing the email is not decoration. The navigation previously rendered
 * "Sign out" whether or not a session existed, so a dropped or replaced session
 * was invisible until a click bounced to the login page. Now who you are is on
 * screen at all times.
 */
export async function AppNav() {
  const session = await auth();
  return <IslandNav variant="app" {...(session?.user?.email ? { user: session.user.email } : {})} />;
}
