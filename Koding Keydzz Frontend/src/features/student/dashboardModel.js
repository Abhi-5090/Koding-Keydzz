// Helpers that normalize the real backend dashboard + auth user into the shape
// the UI renders. No fabricated values — everything is derived from live data.

/**
 * Build display stats from the authenticated user and the dashboard payload.
 * Dashboard wins for live xp/level/coins; the user object supplies identity.
 */
export function buildStats(user = {}, dashboard) {
  const levelInfo = dashboard?.progress?.level || {}
  const xp = dashboard?.xp ?? user?.xp ?? 0
  // Per-level XP span for an accurate progress bar that resets each level.
  const span =
    levelInfo.nextLevelXp != null && levelInfo.currentLevelXp != null
      ? Math.max(1, levelInfo.nextLevelXp - levelInfo.currentLevelXp)
      : 100
  return {
    name: user?.name ?? '',
    grade: user?.grade ?? '',
    school: user?.school ?? '',
    level: dashboard?.level ?? user?.level ?? 1,
    xp,
    coins: dashboard?.coins ?? user?.coins ?? 0,
    // XP earned into the current level + how much the current level spans.
    xpIntoLevel: levelInfo.xpIntoLevel ?? 0,
    xpLevelSpan: span,
    levelPercent: levelInfo.percent ?? null,
    overallPercent: dashboard?.progress?.overallPercent ?? null,
  }
}

const DEFAULT_AVATAR = '🦊'

/**
 * Resolve the emoji for the user's equipped skin from the avatar catalog.
 * Falls back to the friendly fox when the catalog or skin is unavailable.
 */
export function resolveAvatarIcon(user, catalog = []) {
  const skinKey = user?.avatar?.skin
  if (skinKey && catalog.length) {
    const item = catalog.find((i) => i.key === skinKey)
    if (item?.asset) return item.asset
  }
  return DEFAULT_AVATAR
}
