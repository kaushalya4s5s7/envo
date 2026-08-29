import { describe, test, expect, afterAll } from 'bun:test';
import { getDb } from './db';
import {
  ensureUser, ensureMembership, getPrimaryOrg, listMembers,
  createInvitation, listPendingInvitations,
} from './accounts-store';

const emails: string[] = [];
const orgIds: string[] = [];
const userIds: string[] = [];

afterAll(async () => {
  const sql = await getDb();
  if (userIds.length) await sql`DELETE FROM memberships WHERE user_id = ANY(${userIds})`;
  if (emails.length) await sql`DELETE FROM invitations WHERE email = ANY(${emails})`;
  if (orgIds.length) await sql`DELETE FROM organizations WHERE id = ANY(${orgIds})`;
  if (userIds.length) await sql`DELETE FROM users WHERE id = ANY(${userIds})`;
});

function uniqueEmail() {
  const e = `test-${crypto.randomUUID()}@example.com`;
  emails.push(e);
  return e;
}

describe('accounts-store', () => {
  test('ensureUser creates a user, and is idempotent by email', async () => {
    const email = uniqueEmail();
    const first = await ensureUser(email, 'First Name');
    userIds.push(first.id);
    const second = await ensureUser(email, 'Updated Name');
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Updated Name');
  });

  test('ensureMembership creates a personal org when there is no pending invite', async () => {
    const email = uniqueEmail();
    const user = await ensureUser(email, 'Solo Owner');
    userIds.push(user.id);
    await ensureMembership(user.id, email, 'Solo Owner');
    const org = await getPrimaryOrg(user.id);
    expect(org?.role).toBe('owner');
    if (org) orgIds.push(org.orgId);
  });

  test('ensureMembership is idempotent — calling twice does not create a second org', async () => {
    const email = uniqueEmail();
    const user = await ensureUser(email, null);
    userIds.push(user.id);
    await ensureMembership(user.id, email, null);
    const first = await getPrimaryOrg(user.id);
    await ensureMembership(user.id, email, null);
    const second = await getPrimaryOrg(user.id);
    expect(second?.orgId).toBe(first?.orgId);
    if (first) orgIds.push(first.orgId);
  });

  test('a pending invitation is applied instead of creating a personal org', async () => {
    const owner = await ensureUser(uniqueEmail(), 'Inviter');
    userIds.push(owner.id);
    await ensureMembership(owner.id, owner.email, 'Inviter');
    const ownerOrg = await getPrimaryOrg(owner.id);
    if (!ownerOrg) throw new Error('setup failed');
    orgIds.push(ownerOrg.orgId);

    const inviteeEmail = uniqueEmail();
    await createInvitation(ownerOrg.orgId, inviteeEmail, 'viewer', owner.id);

    const invitee = await ensureUser(inviteeEmail, 'Invited Person');
    userIds.push(invitee.id);
    await ensureMembership(invitee.id, inviteeEmail, 'Invited Person');

    const inviteeOrg = await getPrimaryOrg(invitee.id);
    expect(inviteeOrg?.orgId).toBe(ownerOrg.orgId);
    expect(inviteeOrg?.role).toBe('viewer');

    const members = await listMembers(ownerOrg.orgId);
    expect(members.some((m) => m.userId === invitee.id && m.role === 'viewer')).toBe(true);

    const pendingAfter = await listPendingInvitations(ownerOrg.orgId);
    expect(pendingAfter.some((i) => i.email === inviteeEmail)).toBe(false);
  });

  test('creating a second invitation for the same org+email replaces the first, not stacks', async () => {
    const owner = await ensureUser(uniqueEmail(), 'Owner Two');
    userIds.push(owner.id);
    await ensureMembership(owner.id, owner.email, 'Owner Two');
    const org = await getPrimaryOrg(owner.id);
    if (!org) throw new Error('setup failed');
    orgIds.push(org.orgId);

    const invitee = uniqueEmail();
    await createInvitation(org.orgId, invitee, 'viewer', owner.id);
    await createInvitation(org.orgId, invitee, 'operator', owner.id);

    const pending = await listPendingInvitations(org.orgId);
    const matching = pending.filter((i) => i.email === invitee);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.role).toBe('operator');
  });

  test('getPrimaryOrg prefers an owner membership over an earlier operator one', async () => {
    const user = await ensureUser(uniqueEmail(), 'Multi Org');
    userIds.push(user.id);

    const sql = await getDb();
    const operatorOrgId = crypto.randomUUID();
    const ownerOrgId = crypto.randomUUID();
    orgIds.push(operatorOrgId, ownerOrgId);
    await sql`INSERT INTO organizations (id, name, created_at) VALUES (${operatorOrgId}, 'Operator Org', ${Date.now()})`;
    await sql`INSERT INTO organizations (id, name, created_at) VALUES (${ownerOrgId}, 'Owner Org', ${Date.now() + 1000})`;
    await sql`INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (${user.id}, ${operatorOrgId}, 'operator', ${Date.now()})`;
    await sql`INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (${user.id}, ${ownerOrgId}, 'owner', ${Date.now() + 1000})`;

    const primary = await getPrimaryOrg(user.id);
    expect(primary?.orgId).toBe(ownerOrgId);
  });
});
