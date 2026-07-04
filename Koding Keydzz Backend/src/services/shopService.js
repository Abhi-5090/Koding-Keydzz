import { userRepository } from '../repositories/userRepository.js';
import { avatarItemRepository } from '../repositories/avatarItemRepository.js';
import { purchaseRepository } from '../repositories/purchaseRepository.js';
import { Purchase } from '../models/Purchase.js';
import { ApiError } from '../utils/ApiError.js';
import { ownedKeys } from './avatarService.js';

/**
 * Pure purchase-validation logic. Returns { ok, code, message } so it can be
 * unit-tested without a database. `code` is null on success.
 *
 * @param {object} args
 * @param {object} args.item        AvatarItem-like { price, requiredLevel }
 * @param {number} args.userCoins
 * @param {number} args.userLevel
 * @param {boolean} args.alreadyOwned
 */
export function validatePurchase({ item, userCoins, userLevel, alreadyOwned }) {
  if (!item) {
    return { ok: false, code: 'NOT_FOUND', message: 'Item not found' };
  }
  if (alreadyOwned) {
    return { ok: false, code: 'OWNED', message: 'You already own this item' };
  }
  if (userLevel < (item.requiredLevel || 1)) {
    return {
      ok: false,
      code: 'LEVEL',
      message: `Requires level ${item.requiredLevel}`,
    };
  }
  if (userCoins < (item.price || 0)) {
    return { ok: false, code: 'COINS', message: 'Not enough coins' };
  }
  return { ok: true, code: null, message: 'ok' };
}

export async function getShopItems(userId) {
  const items = await avatarItemRepository.findPurchasable();
  const user = await userRepository.findById(userId);
  const owned = user ? await ownedKeys(user) : [];
  return items.map((item) => ({
    ...item.toObject(),
    owned: owned.includes(item.key),
  }));
}

export async function getPurchaseHistory(userId) {
  return purchaseRepository.findByUser(userId);
}

/**
 * Purchase an avatar item: validate, deduct coins atomically, add to inventory,
 * and record the Purchase.
 */
export async function purchaseItem(userId, itemKey) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const item = await avatarItemRepository.findByKey(itemKey);
  if (!item) throw ApiError.notFound('Item not found');

  const owned = await ownedKeys(user);
  const result = validatePurchase({
    item,
    userCoins: user.coins,
    userLevel: user.level,
    alreadyOwned: owned.includes(itemKey),
  });

  if (!result.ok) {
    throw ApiError.badRequest(result.message);
  }

  // Atomic coin deduction + inventory add guarded by a coins-sufficient filter
  // and an inventory-not-present filter to avoid double purchase under races.
  const updated = await userRepository.model.findOneAndUpdate(
    { _id: userId, coins: { $gte: item.price }, inventory: { $ne: item.key } },
    { $inc: { coins: -item.price }, $addToSet: { inventory: item.key } },
    { new: true }
  );

  if (!updated) {
    // Lost the race (coins changed or already owned between read and write).
    throw ApiError.badRequest('Purchase could not be completed');
  }

  await Purchase.create({
    user: userId,
    item: item._id,
    itemKey: item.key,
    priceCoins: item.price,
    coinsSpent: item.price,
  });

  return { coins: updated.coins, item };
}

export default {
  validatePurchase,
  getShopItems,
  getPurchaseHistory,
  purchaseItem,
};
