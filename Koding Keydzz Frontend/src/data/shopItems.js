// Purely-presentational shop config: rarity styling + category labels.
// The shop catalog itself comes from GET /shop/items.

export const SHOP_RARITY = {
  common: { label: 'Common', ring: 'border-text-secondary/40', text: 'text-text-secondary', glow: '' },
  rare: { label: 'Rare', ring: 'border-success', text: 'text-success', glow: 'shadow-[0_0_18px_rgba(52,211,153,0.45)]' },
  epic: { label: 'Epic', ring: 'border-turmeric', text: 'text-turmeric', glow: 'shadow-golden-glow' },
  legendary: { label: 'Legendary', ring: 'border-accent', text: 'text-accent', glow: 'shadow-golden-glow-lg animate-pulse-glow' },
}

// Friendly, capitalized labels for the backend item `type` field.
export const CATEGORY_LABEL = {
  skin: 'Skins',
  outfit: 'Outfits',
  accessory: 'Accessories',
  pet: 'Pets',
  effect: 'Effects',
}

const categoryLabel = (type) => CATEGORY_LABEL[type] || (type ? type[0].toUpperCase() + type.slice(1) : 'Other')

/**
 * Normalize a backend shop item ({ key, name, type, price, requiredLevel,
 * rarity, asset, owned }) for the marketplace UI.
 */
// Avatar item types that map to an equippable slot (see backend avatarService).
export const EQUIPPABLE_TYPES = new Set([
  'skin',
  'outfit',
  'accessory',
  'pet',
  'effect',
  'background',
])

export function decorateShopItem(item) {
  return {
    id: item.key,
    key: item.key,
    name: item.name,
    icon: item.asset || '❓',
    price: item.price ?? 0,
    level: item.requiredLevel ?? 1,
    rarity: item.rarity || 'common',
    type: item.type || null,
    category: categoryLabel(item.type),
    owned: !!item.owned,
    equippable: EQUIPPABLE_TYPES.has(item.type),
  }
}

/** Build the category tab list (always starting with "All") from live items. */
export function buildCategories(items = []) {
  const seen = []
  for (const it of items) {
    if (!seen.includes(it.category)) seen.push(it.category)
  }
  return ['All', ...seen]
}
