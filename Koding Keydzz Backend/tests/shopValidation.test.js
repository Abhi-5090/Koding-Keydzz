import { describe, it, expect } from 'vitest';
import { validatePurchase } from '../src/services/shopService.js';

const item = { price: 100, requiredLevel: 3 };

describe('shop purchase validation', () => {
  it('rejects a missing item', () => {
    const r = validatePurchase({ item: null, userCoins: 999, userLevel: 99, alreadyOwned: false });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('NOT_FOUND');
  });

  it('rejects an already-owned item', () => {
    const r = validatePurchase({ item, userCoins: 999, userLevel: 99, alreadyOwned: true });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('OWNED');
  });

  it('rejects when below required level', () => {
    const r = validatePurchase({ item, userCoins: 999, userLevel: 2, alreadyOwned: false });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('LEVEL');
  });

  it('rejects when not enough coins', () => {
    const r = validatePurchase({ item, userCoins: 50, userLevel: 5, alreadyOwned: false });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('COINS');
  });

  it('accepts a valid purchase', () => {
    const r = validatePurchase({ item, userCoins: 100, userLevel: 3, alreadyOwned: false });
    expect(r.ok).toBe(true);
    expect(r.code).toBeNull();
  });

  it('treats free items with requiredLevel 1 by default', () => {
    const r = validatePurchase({ item: { price: 0 }, userCoins: 0, userLevel: 1, alreadyOwned: false });
    expect(r.ok).toBe(true);
  });
});
