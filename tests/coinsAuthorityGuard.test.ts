import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('coin authority', () => {
  it('keeps coin mutation server-side', () => {
    const src = read('lib/firebase/coins.ts');
    expect(src).not.toMatch(/setDoc|updateDoc|runTransaction|FieldValue\.increment/);
    expect(src).toContain('/api/award-coins');
    expect(src).toContain('/api/spend-coins');
  });

  it('does not trust reward amount from client', () => {
    const src = read('app/api/award-coins/route.ts');
    expect(src).toContain('const COINS_PER_VIDEO = 50');
    expect(src).toContain('const MAX_VIDEOS_PER_DAY = 5');
    expect(src).toContain('reward.minWatchUntil');
    expect(src).toContain('tx.set(userRef');
  });

  it('uses server-side store prices', () => {
    const src = read('app/api/spend-coins/route.ts');
    expect(src).toContain('const uid = await verifyAuthToken(req)');
    expect(src).toContain('const STORE_PRICES');
    expect(src).toContain('STORE_PRICES[itemId]');
    expect(src).toContain('FieldValue.increment(-item.price)');
  });

  it('uses reward sessions in the video UI', () => {
    const src = read('app/store/components/VideoReward.tsx');
    expect(src).toContain("body: JSON.stringify({ action: 'start' })");
    expect(src).toContain("body: JSON.stringify({ action: 'claim', rewardId })");
  });

  it('blocks ledger and purchase writes in rules', () => {
    const src = read('firestore.rules');
    expect(src).toContain('match /users/{userId}/coinHistory/{historyId}');
    expect(src).toContain('match /users/{userId}/purchases/{purchaseId}');
  });
});
