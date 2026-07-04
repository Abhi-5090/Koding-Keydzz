import { userRepository } from '../repositories/userRepository.js';
import { avatarItemRepository } from '../repositories/avatarItemRepository.js';
import { ApiError } from '../utils/ApiError.js';

// Avatar slots that map directly onto User.avatar fields, keyed by item type.
const SLOT_BY_TYPE = {
  skin: 'skin',
  outfit: 'outfit',
  accessory: 'accessory',
  pet: 'pet',
  effect: 'profileEffect',
  background: 'background',
};

/**
 * The full set of item keys a user owns: default items are always owned, plus
 * whatever is in their inventory array.
 */
export async function ownedKeys(user) {
  const defaults = await avatarItemRepository.findDefaults();
  const defaultKeys = defaults.map((d) => d.key);
  return Array.from(new Set([...defaultKeys, ...(user.inventory || [])]));
}

export function getCatalog() {
  return avatarItemRepository.findAll();
}

export async function getMyAvatar(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const owned = await ownedKeys(user);
  const ownedItems = await avatarItemRepository.findByKeys(owned);

  return {
    avatar: user.avatar,
    inventory: owned,
    ownedItems,
  };
}

/**
 * Equip an owned avatar item by key. Validates the item exists and is owned,
 * then writes it into the correct avatar slot for its type.
 */
export async function equipItem(userId, key) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const item = await avatarItemRepository.findByKey(key);
  if (!item) throw ApiError.notFound('Avatar item not found');

  const owned = await ownedKeys(user);
  if (!owned.includes(key)) {
    throw ApiError.badRequest('You do not own this item');
  }

  const slot = SLOT_BY_TYPE[item.type];
  if (!slot) throw ApiError.badRequest('Item type cannot be equipped');

  user.avatar[slot] = key;
  await user.save();

  return { avatar: user.avatar };
}

export default { getCatalog, getMyAvatar, equipItem, ownedKeys };
