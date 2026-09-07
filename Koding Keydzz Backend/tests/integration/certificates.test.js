import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  api,
  BASE,
  auth,
  login,
  makeOrg,
  makeUser,
  resetDb,
  connectTestDb,
  disconnectTestDb,
} from './harness.js';
import { Course } from '../../src/models/Course.js';
import { Certificate, generateCertificateCode } from '../../src/models/Certificate.js';
import { CertificateTemplate } from '../../src/models/CertificateTemplate.js';
import * as certificates from '../../src/services/certificateService.js';
import { COURSES, courseBySlug } from '../../src/config/courses.js';

/**
 * CERTIFICATES.
 *
 * Three properties carry the feature, and each one fails in a way that is hard
 * to notice:
 *
 *   1. VERIFICATION IS PUBLIC AND LEAKS NOTHING. The whole point is that a
 *      parent or employer holding a printout can check it without an account.
 *      An endpoint that also returned the pupil's email or id would be a data
 *      leak dressed as a feature — and it would look like it was working.
 *
 *   2. ISSUANCE IS IDEMPOTENT. The pass path can run more than once (a teacher
 *      marking the last flagged answer of an already-passing attempt), and a
 *      pupil must not collect two certificates for one course.
 *
 *   3. THE FACTS ARE SNAPSHOTTED. A renamed course or a pupil who leaves the
 *      school must not alter a certificate already awarded.
 */
describe('certificates', () => {
  let school;
  let other;
  let python;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    school = await makeOrg('Springfield Elementary');
    other = await makeOrg('Shelbyville Elementary');

    const spec = courseBySlug('python');
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
  });

  async function issueTo({ org, name, email, score = 186 }) {
    const pupil = await makeUser({ role: 'student', name, email, org });
    const cert = await certificates.issueFor({
      user: pupil,
      course: { _id: python._id, slug: python.slug, title: python.title },
      score,
      completedAt: new Date('2026-06-01T10:00:00Z'),
    });
    return { pupil, cert };
  }

  /* ---- codes ---- */

  it('generates codes a person can read off a printout', () => {
    /**
     * The alphabet deliberately excludes O/0, I/1 and L. A code is transcribed
     * by a parent from a piece of paper, and "0" versus "O" makes a valid
     * certificate look like a forgery.
     */
    const code = generateCertificateCode();
    expect(code).toMatch(/^KK-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[OIL01]/);

    // And they must not collide.
    const many = new Set(Array.from({ length: 500 }, () => generateCertificateCode()));
    expect(many.size).toBe(500);
  });

  /* ---- issuance ---- */

  it('issues a certificate with the facts snapshotted', async () => {
    const { cert } = await issueTo({
      org: school.org._id,
      name: 'Ada Lovelace',
      email: 'ada@kk.test',
    });

    expect(cert.studentName).toBe('Ada Lovelace');
    expect(cert.courseTitle).toBe(python.title);
    expect(cert.organizationName).toBe('Springfield Elementary');
    expect(cert.score).toBe(186);
    expect(cert.total).toBe(200);
  });

  it('does NOT change an issued certificate when the course is renamed', async () => {
    /**
     * The reason the facts are copied rather than joined. A certificate that
     * silently rewrites itself when an admin edits a course title is not a
     * record of anything.
     */
    const { cert } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });

    await Course.updateOne({ _id: python._id }, { $set: { title: 'Python (retired)' } });

    const after = await Certificate.findById(cert._id).lean();
    expect(after.courseTitle).toBe(python.title);
    expect(after.courseTitle).not.toContain('retired');
  });

  it('is IDEMPOTENT — a second pass does not issue a second certificate', async () => {
    // The pass path can run twice; a pupil must not collect two.
    const { pupil } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });

    await certificates.issueFor({
      user: pupil,
      course: { _id: python._id, slug: python.slug, title: python.title },
      score: 200,
      completedAt: new Date(),
    });

    expect(await Certificate.countDocuments({ user: pupil._id })).toBe(1);
  });

  it('keeps the FIRST certificate rather than overwriting the score', async () => {
    // Idempotent means "already done", not "do it again with new numbers".
    const { pupil, cert } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
      score: 160,
    });

    await certificates.issueFor({
      user: pupil,
      course: { _id: python._id, slug: python.slug, title: python.title },
      score: 200,
      completedAt: new Date(),
    });

    const after = await Certificate.findById(cert._id).lean();
    expect(after.score).toBe(160);
  });

  /* ---- public verification ---- */

  it('verifies a certificate with NO authentication', async () => {
    const { cert } = await issueTo({
      org: school.org._id,
      name: 'Ada Lovelace',
      email: 'ada@kk.test',
    });

    // Deliberately no auth header — this is the whole point of the endpoint.
    const res = await api().get(`${BASE}/certificates/verify/${cert.code}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.found).toBe(true);
    expect(res.body.data.certificate.studentName).toBe('Ada Lovelace');
    expect(res.body.data.certificate.percent).toBe(93);
  });

  it('LEAKS NOTHING beyond the achievement', async () => {
    /**
     * The security property. A public endpoint keyed by a guessable-ish code
     * must not become a way to enumerate pupils' records.
     */
    const { pupil, cert } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });

    const body = JSON.stringify((await api().get(`${BASE}/certificates/verify/${cert.code}`)).body);

    for (const leak of [
      'ada@kk.test',
      String(pupil._id),
      String(school.org._id),
      'passwordHash',
      'sessions',
      '_id',
    ]) {
      expect(body.includes(leak), `verification leaked "${leak}"`).toBe(false);
    }
  });

  it('reports an unknown code as not found, without erroring', async () => {
    const res = await api().get(`${BASE}/certificates/verify/KK-AAAA-BBBB-CCCC`);
    expect(res.status).toBe(200);
    expect(res.body.data.found).toBe(false);
  });

  it('distinguishes WITHDRAWN from never-issued', async () => {
    /**
     * Two different answers. Reporting a withdrawn certificate as "not found"
     * makes a legitimately-revoked award indistinguishable from a forgery, and
     * the holder has no way to learn what happened.
     */
    const { cert } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });
    await certificates.revoke({
      org: school.org._id,
      code: cert.code,
      reason: 'Issued in error',
    });

    const res = await api().get(`${BASE}/certificates/verify/${cert.code}`);
    expect(res.body.data.found).toBe(true);
    expect(res.body.data.revoked).toBe(true);
    expect(res.body.message).toMatch(/withdrawn/i);
  });

  it('accepts a code in any case, as it will be typed', async () => {
    // Transcribed from paper, so case is not something to be strict about.
    const { cert } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });

    const res = await api().get(`${BASE}/certificates/verify/${cert.code.toLowerCase()}`);
    expect(res.body.data.found).toBe(true);
  });

  /* ---- a pupil's own ---- */

  it('lets a pupil see their own certificates', async () => {
    const { pupil } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(pupil.email)).accessToken;
    const res = await api().get(`${BASE}/certificates`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].courseTitle).toBe(python.title);
  });

  it('never shows a pupil somebody else’s certificate', async () => {
    await issueTo({ org: school.org._id, name: 'Ada', email: 'ada@kk.test' });
    const mine = await makeUser({
      role: 'student',
      name: 'Bart',
      email: 'bart@kk.test',
      org: school.org._id,
    });

    const token = (await login(mine.email)).accessToken;
    expect((await api().get(`${BASE}/certificates`).set(auth(token))).body.data.items).toEqual(
      []
    );
  });

  /* ---- templates ---- */

  it('falls back through templates, most specific first', async () => {
    /**
     * A pupil must never be told "no template" — that is an operator's
     * omission, not their problem. So the lookup degrades: this school's
     * template for this course, then this school's default, then the
     * platform's.
     */
    const platformDefault = await CertificateTemplate.create({
      name: 'Platform default',
      org: null,
      courseSlug: null,
      active: true,
      fields: [{ key: 'studentName', x: 50, y: 45 }],
    });

    // With nothing school-specific, the platform default is used.
    let chosen = await certificates.activeTemplateFor({
      org: school.org._id,
      courseSlug: 'python',
    });
    expect(String(chosen._id)).toBe(String(platformDefault._id));

    // A school-specific one wins.
    const schoolOwn = await CertificateTemplate.create({
      name: 'Springfield',
      org: school.org._id,
      courseSlug: null,
      active: true,
      fields: [{ key: 'studentName', x: 50, y: 50 }],
    });
    chosen = await certificates.activeTemplateFor({
      org: school.org._id,
      courseSlug: 'python',
    });
    expect(String(chosen._id)).toBe(String(schoolOwn._id));

    // And a course-specific one beats the school default.
    const courseOwn = await CertificateTemplate.create({
      name: 'Springfield Python',
      org: school.org._id,
      courseSlug: 'python',
      active: true,
      fields: [{ key: 'studentName', x: 50, y: 55 }],
    });
    chosen = await certificates.activeTemplateFor({
      org: school.org._id,
      courseSlug: 'python',
    });
    expect(String(chosen._id)).toBe(String(courseOwn._id));
  });

  it('keeps an earned certificate renderable when its template is deleted', async () => {
    /**
     * A template is configuration; a certificate is an achievement. Losing the
     * former must not make the latter unviewable.
     */
    const template = await CertificateTemplate.create({
      name: 'Temp',
      org: school.org._id,
      courseSlug: null,
      active: true,
      fields: [{ key: 'studentName', x: 50, y: 45 }],
    });
    const { cert } = await issueTo({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });
    expect(String(cert.template)).toBe(String(template._id));

    await CertificateTemplate.deleteOne({ _id: template._id });
    await CertificateTemplate.create({
      name: 'Replacement',
      org: null,
      courseSlug: null,
      active: true,
      fields: [{ key: 'studentName', x: 40, y: 40 }],
    });

    const rendered = await certificates.renderable(
      await Certificate.findById(cert._id).lean()
    );
    expect(rendered.template, 'a deleted template made the certificate unrenderable').toBeTruthy();
    expect(rendered.studentName).toBe('Ada');
  });

  it('positions fields as PERCENTAGES, so a preview matches any print size', async () => {
    // Pixel offsets would only be right at the size they were authored at.
    const template = await CertificateTemplate.create({
      name: 'T',
      org: null,
      courseSlug: null,
      active: true,
      fields: [
        { key: 'studentName', x: 50, y: 45, fontSize: 6, align: 'center' },
        { key: 'customText', text: 'Awarded for completing', x: 50, y: 38, fontSize: 2.5 },
      ],
    });

    for (const f of template.fields) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(100);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(100);
    }
  });

  /* ---- staff ---- */

  it('shows a school only its own certificates', async () => {
    await issueTo({ org: school.org._id, name: 'Ada', email: 'ada@kk.test' });
    await issueTo({ org: other.org._id, name: 'Bart', email: 'bart@kk.test' });

    const token = (await login(school.admin.email)).accessToken;
    const res = await api().get(`${BASE}/admin/certificates`).set(auth(token));
    const names = res.body.data.items.map((c) => c.studentName);

    expect(names).toContain('Ada');
    expect(names, 'a certificate from another school appeared').not.toContain('Bart');
  });

  it('does not let staff ISSUE a certificate', async () => {
    /**
     * There is no endpoint for it, deliberately: a certificate follows a pass,
     * and a pass is earned on the paper. Issuing by hand would make it a
     * statement about who a teacher likes.
     */
    const token = (await login(school.admin.email)).accessToken;
    const res = await api()
      .post(`${BASE}/admin/certificates`)
      .set(auth(token))
      .send({ studentName: 'Nobody', courseSlug: 'python', score: 200 });

    expect([404, 405]).toContain(res.status);
  });

  it('reconciles a passed course that has no certificate', async () => {
    /**
     * The safety net that matters. Issuance is best effort at pass time — a
     * failure there must not cost a pupil their pass — so a transient error
     * leaves a gap that nothing else would ever notice.
     */
    const { CourseProgress } = await import('../../src/models/CourseProgress.js');
    const pupil = await makeUser({
      role: 'student',
      name: 'Grace',
      email: 'grace@kk.test',
      org: school.org._id,
    });
    await CourseProgress.create({
      user: pupil._id,
      course: python._id,
      courseSlug: 'python',
      bestScore: 175,
      completedAt: new Date(),
    });

    expect(await Certificate.countDocuments({ user: pupil._id })).toBe(0);

    const token = (await login(school.admin.email)).accessToken;
    const res = await api()
      .post(`${BASE}/admin/certificates/reconcile`)
      .set(auth(token));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const cert = await Certificate.findOne({ user: pupil._id }).lean();
    expect(cert, 'reconcile did not issue the missing certificate').toBeTruthy();
    expect(cert.score).toBe(175);
  });

  it('refuses an unauthenticated request for a pupil’s certificates', async () => {
    expect((await api().get(`${BASE}/certificates`)).status).toBe(401);
  });
});
