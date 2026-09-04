import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockFetchRoutes, makeStore } from '../test/renderWithProviders';
import Achievements, { describeCriteria, CRITERIA_TYPES } from './Achievements';

/**
 * TWO BUGS THIS PAGE SHIPPED WITH.
 *
 * 1. IT CRASHED. `criteria` is stored as `{ type, target }` and the page
 *    rendered it straight into JSX — React error #31, "Objects are not valid
 *    as a React child". The whole route died, and because the route error
 *    boundary reports a failed chunk, the user was told "This page didn't
 *    load — reload to try again", which never helped.
 *
 * 2. ITS EDITOR PRODUCED BADGES THAT COULD NEVER BE EARNED. The criteria field
 *    was a free-text box with the placeholder "xp >= 2000". The server only
 *    evaluates `{ type, target }` against a fixed list of types, so a
 *    hand-typed string yielded progress that was permanently 0 — a badge no
 *    pupil could ever unlock, with nothing to say why.
 */

function superStore() {
  return makeStore({
    auth: {
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        _id: 'su1',
        name: 'Super Admin',
        role: 'superadmin',
        org: null,
        capabilities: ['content:read', 'content:write'],
      },
    },
  });
}

// Shaped exactly as the API returns it — criteria is an OBJECT.
const BADGES = [
  {
    _id: 'a1',
    key: 'first-code',
    title: 'First Code',
    description: 'Complete your first game level.',
    icon: 'medal',
    criteria: { type: 'levelsCompleted', target: 1 },
    xpReward: 50,
    coinReward: 10,
  },
  {
    _id: 'a2',
    key: 'rising-star',
    title: 'Rising Star',
    description: 'Reach level 10.',
    icon: 'zap',
    criteria: { type: 'reachLevel', target: 10 },
    xpReward: 100,
    coinReward: 20,
  },
];

describe('describeCriteria', () => {
  it('renders a structured rule as a sentence', () => {
    expect(describeCriteria({ type: 'levelsCompleted', target: 20 })).toBe(
      'Game levels completed: 20 levels'
    );
  });

  it('words "reach level" naturally rather than as a count', () => {
    expect(describeCriteria({ type: 'reachLevel', target: 10 })).toBe('Reach level 10');
  });

  it('never returns an object', () => {
    // The whole point: this is what gets put in JSX.
    for (const c of [null, undefined, {}, { type: 'levelsCompleted', target: 5 }, 'xp >= 2000']) {
      expect(typeof describeCriteria(c)).toBe('string');
    }
  });

  it('says plainly when a rule can never unlock', () => {
    // Both legacy free-text rows and unknown types are dead badges. Saying so
    // is how the ones already in the database get noticed.
    expect(describeCriteria(null)).toMatch(/never be earned/i);
    expect(describeCriteria({ type: 'xpGreaterThan', target: 2000 })).toMatch(/never be earned/i);
    expect(describeCriteria('xp >= 2000')).toMatch(/not a valid rule/i);
  });

  it('covers every type the server can evaluate, and nothing it cannot', () => {
    // Mirrors backend src/utils/achievementProgress.js `currentValueFor`. If
    // the server gains a type, this list is what has to grow with it.
    const SERVER_TYPES = [
      'levelsCompleted',
      'perfectLevels',
      'quizzesPassed',
      'lessonsCompleted',
      'totalXp',
      'reachLevel',
      'coinsEarned',
      'worldsUnlocked',
      'dailyChallenge',
    ];
    expect(CRITERIA_TYPES.map((c) => c.value).sort()).toEqual([...SERVER_TYPES].sort());
  });
});

describe('the page renders without crashing on object criteria', () => {
  it('lists every badge and its rule', async () => {
    mockFetchRoutes({ '/admin/achievements': BADGES });
    renderWithProviders(<Achievements />, { route: '/achievements', store: superStore() });

    await waitFor(() => expect(screen.getByText('First Code')).toBeInTheDocument());
    expect(screen.getByText('Rising Star')).toBeInTheDocument();

    // The rule is shown as text — this is the exact render that used to throw.
    // Scoped by the "Unlocks at:" label, because "Reach level 10" is also the
    // badge's own description and a bare text match is ambiguous.
    const rules = screen.getAllByText(/Unlocks at:/);
    expect(rules).toHaveLength(2);
    const ruleText = rules.map((el) => el.parentElement.textContent).join(' ');
    expect(ruleText).toMatch(/Game levels completed: 1 levels/);
    expect(ruleText).toMatch(/Reach level 10/);
  });

  it('survives a badge with no criteria at all', async () => {
    mockFetchRoutes({
      '/admin/achievements': [{ _id: 'x', key: 'broken', title: 'Broken Badge', icon: 'medal' }],
    });
    renderWithProviders(<Achievements />, { route: '/achievements', store: superStore() });

    await waitFor(() => expect(screen.getByText('Broken Badge')).toBeInTheDocument());
    // And it says so, rather than rendering blank.
    expect(screen.getByText(/never be earned/i)).toBeInTheDocument();
  });

  it('survives a legacy free-text criteria row', async () => {
    // Rows created by the old editor are still in the database.
    mockFetchRoutes({
      '/admin/achievements': [
        { _id: 'y', key: 'legacy', title: 'Legacy Badge', icon: 'medal', criteria: 'xp >= 2000' },
      ],
    });
    renderWithProviders(<Achievements />, { route: '/achievements', store: superStore() });

    await waitFor(() => expect(screen.getByText('Legacy Badge')).toBeInTheDocument());
    expect(screen.getByText(/not a valid rule/i)).toBeInTheDocument();
  });
});
