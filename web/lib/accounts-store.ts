import { getDb } from './db';

/**
 * Real accounts: a User belongs to one or more Organizations via a
 * Membership carrying a role. Matches the domain model already sketched in
 * docs/flows/product-flow.md — this makes it real rather than a sketch.
 *
 * Postgres BIGINT columns come back as JS strings, not numbers — verified
 * directly before writing this file. Every row mapper below converts them.
 */

export type Role = 'owner' | 'operator' | 'viewer';

export interface Account {
  id: string;
  email: string;
  name: string | null;
  createdAt: number;
}

export interface Membership {
  orgId: string;
  orgName: string;
  role: Role;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  invitedBy: string;
  createdAt: number;
}

export interface OrgMember {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: number;
}

/** Finds or creates the user row for this email. Idempotent — safe to call every request. */
export async function ensureUser(email: string, name: string | null): Promise<Account> {
  const sql = await getDb();
  const [row] = await sql<{ id: string; email: string; name: string | null; created_at: string }[]>`
    INSERT INTO users (id, email, name, created_at)
    VALUES (${crypto.randomUUID()}, ${email}, ${name}, ${Date.now()})
    ON CONFLICT (email) DO UPDATE SET name = COALESCE(${name}, users.name)
    RETURNING id, email, name, created_at
  `;
  return { id: row!.id, email: row!.email, name: row!.name, createdAt: Number(row!.created_at) };
}

/**
 * Ensures this user has at least one org membership, and returns it. First
 * applies any pending invitation for their email (joining a teammate's org
 * with the invited role), and only if none exists, creates a personal org
 * where they are the owner. Idempotent — safe to call every request.
 *
 * Returns the membership directly (reusing getPrimaryOrg's query) rather
 * than making the caller fetch it again separately — this runs on every
 * authenticated page load via getCurrentAccount, so one fewer round trip
 * against a remote Postgres instance is not free to skip.
 */
export async function ensureMembership(userId: string, email: string, name: string | null): Promise<Membership> {
  const sql = await getDb();

  const pending = await sql<{ id: string; org_id: string; role: Role }[]>`
    SELECT id, org_id, role FROM invitations
    WHERE email = ${email} AND accepted_at IS NULL
  `;
  for (const invite of pending) {
    await sql`
      INSERT INTO memberships (user_id, org_id, role, created_at)
      VALUES (${userId}, ${invite.org_id}, ${invite.role}, ${Date.now()})
      ON CONFLICT (user_id, org_id) DO NOTHING
    `;
    await sql`UPDATE invitations SET accepted_at = ${Date.now()} WHERE id = ${invite.id}`;
  }

  const existing = await getPrimaryOrg(userId);
  if (existing) return existing;

  const orgId = crypto.randomUUID();
  const orgName = `${name ?? email}’s workspace`;
  await sql`INSERT INTO organizations (id, name, created_at) VALUES (${orgId}, ${orgName}, ${Date.now()})`;
  await sql`
    INSERT INTO memberships (user_id, org_id, role, created_at)
    VALUES (${userId}, ${orgId}, 'owner', ${Date.now()})
  `;
  return { orgId, orgName, role: 'owner' };
}

/**
 * The org a user acts against when none is specified elsewhere. Owner
 * memberships win over invited ones; ties broken by whichever came first.
 * Multiple orgs (e.g. an owner also invited elsewhere) have no switcher yet —
 * a known simplification, not a hidden one.
 */
export async function getPrimaryOrg(userId: string): Promise<Membership | null> {
  const sql = await getDb();
  const [row] = await sql<{ org_id: string; org_name: string; role: Role }[]>`
    SELECT m.org_id, o.name as org_name, m.role
    FROM memberships m JOIN organizations o ON o.id = m.org_id
    WHERE m.user_id = ${userId}
    ORDER BY (m.role = 'owner') DESC, m.created_at ASC
    LIMIT 1
  `;
  return row ? { orgId: row.org_id, orgName: row.org_name, role: row.role } : null;
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const sql = await getDb();
  const rows = await sql<{ user_id: string; email: string; name: string | null; role: Role; created_at: string }[]>`
    SELECT u.id as user_id, u.email, u.name, m.role, m.created_at
    FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ${orgId}
    ORDER BY m.created_at ASC
  `;
  return rows.map((r) => ({
    userId: r.user_id, email: r.email, name: r.name, role: r.role, createdAt: Number(r.created_at),
  }));
}

export async function listPendingInvitations(orgId: string): Promise<Invitation[]> {
  const sql = await getDb();
  const rows = await sql<
    { id: string; org_id: string; email: string; role: Role; invited_by: string; created_at: string }[]
  >`
    SELECT id, org_id, email, role, invited_by, created_at FROM invitations
    WHERE org_id = ${orgId} AND accepted_at IS NULL
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id, orgId: r.org_id, email: r.email, role: r.role,
    invitedBy: r.invited_by, createdAt: Number(r.created_at),
  }));
}

/** Replaces any existing pending invitation for the same org+email rather than stacking duplicates. */
export async function createInvitation(
  orgId: string, email: string, role: Role, invitedBy: string,
): Promise<Invitation> {
  const sql = await getDb();
  await sql`DELETE FROM invitations WHERE org_id = ${orgId} AND email = ${email} AND accepted_at IS NULL`;
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO invitations (id, org_id, email, role, invited_by, created_at)
    VALUES (${id}, ${orgId}, ${email}, ${role}, ${invitedBy}, ${createdAt})
  `;
  return { id, orgId, email, role, invitedBy, createdAt };
}
