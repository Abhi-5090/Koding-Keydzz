// Purely-presentational world visuals (lucide icon + per-world tint) keyed by
// the backend world slug. The world list itself comes from GET /worlds — this
// only supplies icon/tint the API does not provide. Icons are lucide components
// resolved via iconMap.
//
// SINGLE SOURCE OF TRUTH: the per-world accent `tint` lives in worldThemes.js.
// This module reads it from there so a world's colour is IDENTICAL everywhere
// (map node, world page, lesson modal). Do not hardcode tints here.
import { worldIcon } from './iconMap'
import { worldTheme } from './worldThemes'

export const worldVisual = (slug) => ({ tint: worldTheme(slug).tint })

/**
 * Merge backend world records with local visual config. Returns a normalized
 * shape the UI consumes: { id, name, slug, order, topics, description,
 * requiredLevel, percent, locked, icon, tint }.
 */
export function decorateWorld(world, progressByWorld = {}) {
  const v = worldVisual(world.slug)
  const id = String(world._id ?? world.id)
  const prog = progressByWorld[id] || progressByWorld[world.slug] || {}
  return {
    id,
    name: world.name,
    slug: world.slug,
    order: world.order,
    topics: world.topics || [],
    description: world.description || '',
    requiredLevel: world.requiredLevel ?? 1,
    percent: prog.percent ?? null,
    locked: prog.locked,
    icon: worldIcon(world.slug),
    tint: v.tint,
  }
}
