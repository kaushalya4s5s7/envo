import { describe, test, expect, beforeEach } from 'bun:test';
import { createDb } from './db';
import { subscribe, getSubscription } from './digest-store';

describe('digest-store', () => {
  let db: ReturnType<typeof createDb>;
  beforeEach(() => { db = createDb(':memory:'); });

  test('subscribe then getSubscription returns the cadence', () => {
    subscribe('a@b.com', 'building-1', 'daily', db);
    expect(getSubscription('a@b.com', 'building-1', db)?.cadence).toBe('daily');
  });

  test('getSubscription returns null when none exists', () => {
    expect(getSubscription('a@b.com', 'building-1', db)).toBeNull();
  });

  test('subscribing again for the same user and building replaces the cadence', () => {
    subscribe('a@b.com', 'building-1', 'daily', db);
    subscribe('a@b.com', 'building-1', 'weekly', db);
    expect(getSubscription('a@b.com', 'building-1', db)?.cadence).toBe('weekly');
  });
});
