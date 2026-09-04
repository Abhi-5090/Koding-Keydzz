import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  api,
  BASE,
  auth,
  login,
  makeOrg,
  resetDb,
  connectTestDb,
  disconnectTestDb,
} from './harness.js';
import { MAX_BULK_ROWS } from '../../src/services/studentBulkService.js';

/**
 * ROSTER IMPORT IDEMPOTENCY.
 *
 * Duplicate detection used to key on EMAIL only. Young students have no email
 * — that is the entire reason username login exists — so re-uploading a roster
 * skipped nothing and created a second copy of every child. Observed on a live
 * instance: a 200-pupil school became 401 students on one retry, which is
 * exactly what happens when a large import times out and the admin clicks
 * upload again.
 */
describe('roster import', () => {
  let adminToken;

  const csv = (rows) => Buffer.from(rows.join('\n'), 'utf8');

  const upload = (buffer, filename = 'roster.csv') =>
    api()
      .post(`${BASE}/admin/students/bulk`)
      .set(auth(adminToken))
      .attach('file', buffer, filename)
      .field('password', 'Import@1234');

  const total = async () => {
    const res = await api().get(`${BASE}/admin/students?limit=1`).set(auth(adminToken));
    return res.body.data.total;
  };

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    const made = await makeOrg('Import School');
    adminToken = (await login(made.admin.email)).accessToken;
  });

  it('imports a roster of email-less students', async () => {
    const rows = ['firstName,lastName,grade'];
    for (let i = 1; i <= 10; i += 1) rows.push(`Kid${i},Test${i},5`);

    const res = await upload(csv(rows));
    expect(res.status).toBe(201);
    expect(res.body.data.createdCount).toBe(10);
    expect(res.body.data.skippedCount).toBe(0);
    expect(await total()).toBe(10);
  });

  it('does NOT duplicate email-less students on a re-upload', async () => {
    const rows = ['firstName,lastName,grade'];
    for (let i = 1; i <= 10; i += 1) rows.push(`Kid${i},Test${i},5`);

    await upload(csv(rows));
    expect(await total()).toBe(10);

    const retry = await upload(csv(rows));
    expect(retry.body.data.createdCount).toBe(0);
    expect(retry.body.data.skippedCount).toBe(10);
    // The whole point: the count must not move.
    expect(await total()).toBe(10);
    expect(retry.body.data.skipped[0].reason).toMatch(/already exists/i);
  });

  it('uses rollNumber as the authoritative key when present', async () => {
    const rows = ['rollNumber,firstName,lastName,grade'];
    for (let i = 1; i <= 8; i += 1) rows.push(`2024-${i},Pupil${i},Surname${i},6`);

    await upload(csv(rows));
    expect(await total()).toBe(8);

    const retry = await upload(csv(rows));
    expect(retry.body.data.createdCount).toBe(0);
    expect(await total()).toBe(8);
    expect(retry.body.data.skipped[0].reason).toMatch(/roll number/i);
  });

  it('distinguishes two pupils with the same name via rollNumber', async () => {
    // Namesakes are real. Without a roll number the name fallback would
    // (correctly, but unhelpfully) treat the second as a duplicate.
    const rows = [
      'rollNumber,firstName,lastName,grade',
      '2024-1,Sam,Patel,5',
      '2024-2,Sam,Patel,5',
    ];
    const res = await upload(csv(rows));
    expect(res.body.data.createdCount).toBe(2);
    expect(await total()).toBe(2);
  });

  it('deduplicates repeated rows WITHIN one file', async () => {
    const rows = [
      'rollNumber,firstName,lastName',
      '2024-1,Ana,Diaz',
      '2024-1,Ana,Diaz',
      '2024-2,Ben,Cole',
    ];
    const res = await upload(csv(rows));
    expect(res.body.data.createdCount).toBe(2);
    expect(res.body.data.skippedCount).toBe(1);
    // Caught by the pure row parser ("… in file") or by the DB-backed pass
    // ("… within this file") depending on which key matched first — either is
    // the correct outcome.
    expect(res.body.data.skipped[0].reason).toMatch(/in (this )?file/i);
  });

  it('still dedupes on email when one is supplied', async () => {
    const rows = ['firstName,lastName,email', 'Zoe,Ray,zoe@school.test'];
    await upload(csv(rows));
    const retry = await upload(csv(rows));
    expect(retry.body.data.createdCount).toBe(0);
    expect(await total()).toBe(1);
  });

  it('refuses a file over the row cap with an actionable message', async () => {
    const rows = ['firstName'];
    for (let i = 0; i <= MAX_BULK_ROWS; i += 1) rows.push(`Over${i}`);

    const res = await upload(csv(rows));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(new RegExp(`${MAX_BULK_ROWS}-row limit`));
    // Nothing partially created.
    expect(await total()).toBe(0);
  });

  it('keeps the org student count in step with reality', async () => {
    const rows = ['firstName,lastName'];
    for (let i = 1; i <= 5; i += 1) rows.push(`Count${i},Check${i}`);
    await upload(csv(rows));
    // A re-upload must not inflate the counter either.
    await upload(csv(rows));

    const orgs = await api().get(`${BASE}/admin/students?limit=1`).set(auth(adminToken));
    expect(orgs.body.data.total).toBe(5);
  });

  it('reports per-row reasons for invalid rows instead of failing the batch', async () => {
    const rows = [
      'firstName,lastName,email',
      'Valid,Pupil,',
      ',NoFirstName,',
      'Bad,Email,not-an-email',
    ];
    const res = await upload(csv(rows));
    expect(res.status).toBe(201);
    expect(res.body.data.createdCount).toBe(1);
    expect(res.body.data.skippedCount).toBe(2);
    const reasons = res.body.data.skipped.map((s) => s.reason).join(' ');
    expect(reasons).toMatch(/firstName/i);
    expect(reasons).toMatch(/email/i);
  });

  it('exports a roster that can be re-imported and printed as credentials', async () => {
    const rows = ['rollNumber,firstName,lastName', '2024-1,Ivy,Stone'];
    await upload(csv(rows));

    const res = await api().get(`${BASE}/admin/students/export`).set(auth(adminToken));
    expect(res.status).toBe(200);
    const header = res.text.split('\n')[0];
    // rollNumber makes the export re-importable; username is the login id a
    // teacher hands to the child.
    expect(header).toMatch(/rollNumber/);
    expect(header).toMatch(/username/);
  });
});
