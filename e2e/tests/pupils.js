import { expect } from '@playwright/test';
import { API_URL } from '../playwright.config.js';

/**
 * PUPIL FIXTURES, AND WHY MOST TESTS NEED ONE PAST THE FIRST REALM.
 *
 * Cognitive Games is realm 1 and holds no worlds — four mini-games instead —
 * so a brand-new pupil has NO worlds at all and Python is locked. Every spec
 * whose subject is further up the ladder (the world map, topic sequencing,
 * lessons, the quiz arena, the shop economy) was written when Python was the
 * first thing anyone could open, and against a fresh pupil each of them now
 * asks for content the pupil cannot reach: `GET /worlds` returns `[]` and the
 * first `worlds[0].id` throws.
 *
 * `pupilOnPython` is those specs saying what they mean — a pupil who has done
 * the on-ramp — rather than each one hand-rolling four API calls. Specs that
 * are ABOUT the first realm use `freshPupil` and get a genuinely new account.
 */

/** The four games that make up the first realm. */
export const COGNITIVE_GAMES = [
  'treasure-hunt',
  'space-adventure',
  'logic-puzzle',
  'tic-tac-toe',
];

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

async function adminToken(request) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  return (await res.json()).data.accessToken;
}

/** A brand-new pupil: on Cognitive Games, with Python still locked. */
export async function freshPupil(request, prefix = 'E2e') {
  const token = await adminToken(request);
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      firstName: prefix,
      lastName: `P${Date.now() % 1000000}${Math.floor(Math.random() * 1000)}`,
      grade: '5',
      password: 'Pupil@12345',
    },
  });
  const body = await made.json();
  expect(body?.data?.student, `could not create a pupil: ${JSON.stringify(body)}`).toBeTruthy();
  return { ...body.data.student, password: 'Pupil@12345' };
}

/** A pupil's own access token. */
export async function pupilToken(request, pupil) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: pupil.username, password: pupil.password },
  });
  return (await res.json()).data.accessToken;
}

/**
 * Finish the first level of every cognitive game, through the real endpoint.
 *
 * Deliberately NOT a direct database write: the point is that the same route a
 * child's browser calls is what opens the next realm, so a fixture that wrote
 * `gameProgress` by hand could pass while the actual award path was broken.
 */
export async function completeCognitiveRealm(request, pupil) {
  const token = await pupilToken(request, pupil);
  for (const gameKey of COGNITIVE_GAMES) {
    const res = await request.post(`${API_URL}/games/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { gameKey, levelId: '1', difficulty: 'easy', stars: 3 },
    });
    expect(
      res.ok(),
      `could not complete ${gameKey}: ${res.status()} ${await res.text()}`
    ).toBeTruthy();
  }
}

/** A pupil with the first realm behind them, so Python and its worlds are open. */
export async function pupilOnPython(request, prefix = 'E2e') {
  const pupil = await freshPupil(request, prefix);
  await completeCognitiveRealm(request, pupil);
  return pupil;
}
