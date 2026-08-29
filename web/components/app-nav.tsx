import { getCurrentAccount } from '@/lib/session';
import { AppSidebar } from './app-sidebar';

/**
 * The signed in navigation, with the account and org it belongs to.
 *
 * Showing the email is not decoration. The navigation previously rendered
 * "Sign out" whether or not a session existed, so a dropped or replaced session
 * was invisible until a click bounced to the login page. Now who you are is on
 * screen at all times.
 */
export async function AppNav() {
  const account = await getCurrentAccount();
  return <AppSidebar {...(account ? { user: account.email, orgName: account.orgName } : {})} />;
}
