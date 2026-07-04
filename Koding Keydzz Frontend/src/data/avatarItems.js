// Purely-presentational avatar config: wardrobe slot tabs + rarity styling.
// The item catalog itself comes from GET /avatar/items.

export const AVATAR_SLOTS = [
  { key: 'skin', label: 'Skin', icon: '🎭' },
  { key: 'outfit', label: 'Outfit', icon: '👕' },
  { key: 'accessory', label: 'Accessory', icon: '🎩' },
  { key: 'pet', label: 'Pet', icon: '🐾' },
  { key: 'effect', label: 'Effect', icon: '✨' },
  { key: 'background', label: 'Background', icon: '🌅' },
]

export const RARITIES = {
  common: { label: 'Common', ring: 'border-text-secondary/40', glow: '' },
  rare: { label: 'Rare', ring: 'border-success', glow: 'shadow-[0_0_18px_rgba(76,175,80,0.5)]' },
  epic: { label: 'Epic', ring: 'border-turmeric', glow: 'shadow-golden-glow' },
  legendary: { label: 'Legendary', ring: 'border-accent', glow: 'shadow-golden-glow-lg' },
}

// Backend item.type maps 1:1 to a wardrobe slot.
const SLOT_BY_TYPE = {
  skin: 'skin',
  outfit: 'outfit',
  accessory: 'accessory',
  pet: 'pet',
  effect: 'effect',
  background: 'background',
}

// GET /avatar/me returns avatar:{skin,outfit,accessory,pet,effect,background},
// so the equipped field name matches the wardrobe slot key directly.
export const EQUIP_FIELD_BY_SLOT = {
  skin: 'skin',
  outfit: 'outfit',
  accessory: 'accessory',
  pet: 'pet',
  effect: 'effect',
  background: 'background',
}

/**
 * Normalize a backend AvatarItem ({ key, name, type, price, requiredLevel,
 * rarity, asset }) into the shape the wardrobe UI consumes.
 */
export function decorateAvatarItem(item) {
  return {
    id: item.key,
    key: item.key,
    name: item.name,
    slot: SLOT_BY_TYPE[item.type] || item.type,
    icon: item.asset || '❓',
    rarity: item.rarity || 'common',
    price: item.price ?? 0,
    level: item.requiredLevel ?? 1,
    isDefault: !!item.isDefault,
  }
}
