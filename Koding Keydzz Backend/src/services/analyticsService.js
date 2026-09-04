import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { Classroom } from '../models/Classroom.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { GameScore } from '../models/GameScore.js';
import { Quiz } from '../models/Quiz.js';
import { World } from '../models/World.js';
import { Lesson } from '../models/Lesson.js';
import { Purchase } from '../models/Purchase.js';
import { ApiError } from '../utils/ApiError.js';
import {
  lastNDays,
  lastNMonths,
  densify,
  compare,
  pct,
  avg,
  median,
  bucketize,
} from '../utils/timeseries.js';
import { ROLES } from '../config/permissions.js';

/**
 * Analytics for the superadmin, admin and faculty dashboards.
 *
 * DESIGN NOTES
 * ------------
 * • Every response is CHART-READY: series come back dense (a quiet day is a
 *   zero, not a missing point) and as `{ label, value }` arrays the client can
 *   hand straight to a chart without reshaping.
 *
 * • KPI figures come back as `{ value, previous, delta, direction }` so a tile
 *   can show a trend against the preceding equivalent period. `delta` is null
 *   when there is no honest baseline, rather than a fabricated +100%.
 *
 * • Averages are always paired with a MEDIAN. A few very engaged students skew
 *   a mean badly, and a teacher told "average XP 1,400" when the median is 180
 *   has been misled.
 *
 * • Every org-scoped function REQUIRES `org` and filters on it. Faculty
 *   additionally pass `studentIds` (resolved from their classrooms), which
 *   narrows every query to the children they actually teach.
 *
 * • `deletedAt: null` is on every user query — soft-deleted pupils must not
 *   inflate a count.
 */

const ACTIVE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const XP_BANDS = [
  { label: '0', min: 0, max: 1 },
  { label: '1–199', min: 1, max: 200 },
  { label: '200–999', min: 200, max: 1000 },
  { label: '1k–2.9k', min: 1000, max: 3000 },
  { label: '3k–9.9k', min: 3000, max: 10000 },
  { label: '10k+', min: 10000, max: Infinity },
];

/** Base student filter for a tenant, optionally narrowed to a faculty roster. */
function studentFilter(org, studentIds = null) {
  const f = { role: ROLES.STUDENT, deletedAt: null };
  if (org) f.org = org;
  if (studentIds) f._id = { $in: studentIds };
  return f;
}

/* ========================================================================== */
/* PLATFORM ANALYTICS — superadmin                                            */
/* ========================================================================== */

/**
 * Everything the platform owner needs on one screen: scale, growth,
 * engagement, tenant health and content coverage.
 */
export async function getPlatformAnalytics({ days = 30 } = {}) {
  const now = new Date();
  const dayKeys = lastNDays(days, now);
  const monthKeys = lastNMonths(12, now);
  const since = new Date(now.getTime() - days * DAY_MS);
  const prevSince = new Date(now.getTime() - 2 * days * DAY_MS);
  const monthsSince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const active7 = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);
  const active30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    totalOrgs,
    activeOrgs,
    suspendedOrgs,
    newOrgs,
    prevNewOrgs,
    totalStudents,
    totalFaculty,
    totalAdmins,
    newStudents,
    prevNewStudents,
    dau,
    wau,
    mau,
    prevWau,
    orgGrowthRows,
    studentGrowthRows,
    quizActivityRows,
    prevQuizAttempts,
    quizAttempts,
    gameActivityRows,
    levelRows,
    xpRows,
    planRows,
    orgLeaderRows,
    worldCount,
    lessonCount,
    quizCount,
    purchaseCount,
    passedAttempts,
    totalAttempts,
  ] = await Promise.all([
    Organization.countDocuments(),
    Organization.countDocuments({ status: 'active' }),
    Organization.countDocuments({ status: 'suspended' }),
    Organization.countDocuments({ createdAt: { $gte: since } }),
    Organization.countDocuments({ createdAt: { $gte: prevSince, $lt: since } }),
    User.countDocuments({ role: ROLES.STUDENT, deletedAt: null }),
    User.countDocuments({ role: ROLES.FACULTY, deletedAt: null }),
    User.countDocuments({ role: ROLES.ADMIN, deletedAt: null }),
    User.countDocuments({ role: ROLES.STUDENT, deletedAt: null, createdAt: { $gte: since } }),
    User.countDocuments({
      role: ROLES.STUDENT,
      deletedAt: null,
      createdAt: { $gte: prevSince, $lt: since },
    }),
    User.countDocuments({
      role: ROLES.STUDENT,
      deletedAt: null,
      updatedAt: { $gte: new Date(now.getTime() - DAY_MS) },
    }),
    User.countDocuments({ role: ROLES.STUDENT, deletedAt: null, updatedAt: { $gte: active7 } }),
    User.countDocuments({ role: ROLES.STUDENT, deletedAt: null, updatedAt: { $gte: active30 } }),
    User.countDocuments({
      role: ROLES.STUDENT,
      deletedAt: null,
      updatedAt: { $gte: new Date(active7.getTime() - 7 * DAY_MS), $lt: active7 },
    }),

    // Monthly org + student growth (12 months).
    Organization.aggregate([
      { $match: { createdAt: { $gte: monthsSince } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: ROLES.STUDENT, deletedAt: null, createdAt: { $gte: monthsSince } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),

    // Daily learning activity.
    QuizAttempt.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    QuizAttempt.countDocuments({ createdAt: { $gte: prevSince, $lt: since } }),
    QuizAttempt.countDocuments({ createdAt: { $gte: since } }),
    GameScore.aggregate([
      { $match: { updatedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } },
    ]),

    // Distributions.
    User.aggregate([
      { $match: { role: ROLES.STUDENT, deletedAt: null } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.find({ role: ROLES.STUDENT, deletedAt: null }).select('xp').lean(),
    Organization.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),

    // Per-org rollup for the tenant health table.
    User.aggregate([
      { $match: { role: ROLES.STUDENT, deletedAt: null, org: { $ne: null } } },
      {
        $group: {
          _id: '$org',
          students: { $sum: 1 },
          totalXp: { $sum: '$xp' },
          active7: { $sum: { $cond: [{ $gte: ['$updatedAt', active7] }, 1, 0] } },
          quizzesPassed: { $sum: '$quizzesPassed' },
        },
      },
    ]),

    World.countDocuments(),
    Lesson.countDocuments(),
    Quiz.countDocuments(),
    Purchase.countDocuments(),
    QuizAttempt.countDocuments({ passed: true }),
    QuizAttempt.countDocuments(),
  ]);

  const xpValues = xpRows.map((r) => r.xp || 0);

  // Join the per-org rollup back onto organization documents for names/plans.
  const orgIds = orgLeaderRows.map((r) => r._id);
  const orgDocs = await Organization.find({ _id: { $in: orgIds } }).select(
    'name code status plan seatLimit studentCount facultyCount createdAt'
  );
  const orgById = new Map(orgDocs.map((o) => [String(o._id), o]));

  const orgTable = orgLeaderRows
    .map((r) => {
      const o = orgById.get(String(r._id));
      if (!o) return null;
      return {
        id: String(r._id),
        name: o.name,
        code: o.code,
        status: o.status,
        plan: o.plan,
        students: r.students,
        faculty: o.facultyCount || 0,
        activeStudents: r.active7,
        // The single most useful tenant-health number: what share of a
        // school's pupils actually used the product this week.
        engagementRate: pct(r.active7, r.students),
        avgXp: r.students ? Math.round(r.totalXp / r.students) : 0,
        quizzesPassed: r.quizzesPassed,
        seatLimit: o.seatLimit || 0,
        seatUtilization: o.seatLimit ? pct(r.students, o.seatLimit) : null,
        createdAt: o.createdAt,
      };
    })
    .filter(Boolean);

  // Organizations that look like they are churning: they have pupils, but
  // almost none of them used it this week. This is the actionable list.
  const atRiskOrgs = orgTable
    .filter((o) => o.status === 'active' && o.students >= 5 && o.engagementRate < 25)
    .sort((a, b) => a.engagementRate - b.engagementRate)
    .slice(0, 10);

  return {
    generatedAt: now,
    window: { days, from: since, to: now },

    kpis: {
      organizations: compare(totalOrgs, totalOrgs - newOrgs + prevNewOrgs),
      newOrganizations: compare(newOrgs, prevNewOrgs),
      students: compare(totalStudents, totalStudents - newStudents + prevNewStudents),
      newStudents: compare(newStudents, prevNewStudents),
      faculty: { value: totalFaculty, previous: totalFaculty, delta: 0, direction: 'flat' },
      admins: { value: totalAdmins, previous: totalAdmins, delta: 0, direction: 'flat' },
      weeklyActive: compare(wau, prevWau),
      quizAttempts: compare(quizAttempts, prevQuizAttempts),
    },

    engagement: {
      dau,
      wau,
      mau,
      // Stickiness: what fraction of monthly users come back on a given day.
      // The standard read is that 20%+ is healthy for a learning product.
      dauOverMau: pct(dau, mau),
      wauOverMau: pct(wau, mau),
      activeShare: pct(wau, totalStudents),
    },

    tenants: {
      total: totalOrgs,
      active: activeOrgs,
      suspended: suspendedOrgs,
      byPlan: planRows.map((r) => ({ label: r._id || 'trial', value: r.count })),
      table: orgTable.sort((a, b) => b.students - a.students),
      atRisk: atRiskOrgs,
    },

    series: {
      orgGrowth: densify(orgGrowthRows, monthKeys, 'month'),
      studentGrowth: densify(studentGrowthRows, monthKeys, 'month'),
      quizActivity: densify(quizActivityRows, dayKeys, 'date'),
      gameActivity: densify(gameActivityRows, dayKeys, 'date'),
    },

    distributions: {
      level: levelRows.map((r) => ({ label: `L${r._id || 1}`, value: r.count })),
      xp: bucketize(xpValues, XP_BANDS),
    },

    learning: {
      avgXp: avg(xpValues),
      medianXp: median(xpValues),
      quizPassRate: pct(passedAttempts, totalAttempts),
      totalQuizAttempts: totalAttempts,
      shopPurchases: purchaseCount,
    },

    content: {
      worlds: worldCount,
      lessons: lessonCount,
      quizzes: quizCount,
    },
  };
}

/* ========================================================================== */
/* ORGANIZATION ANALYTICS — admin (whole school) and faculty (their classes)  */
/* ========================================================================== */

/**
 * @param {object} args
 * @param {*} args.org            REQUIRED tenant id
 * @param {string[]|null} [args.studentIds]  faculty scope; null = whole org
 * @param {number} [args.days]
 */
export async function getOrgAnalytics({ org, studentIds = null, days = 30 } = {}) {
  if (!org) throw ApiError.badRequest('An organization is required');

  // A faculty member with no classes yet gets a well-formed empty dashboard
  // rather than the whole school's figures.
  if (studentIds && studentIds.length === 0) {
    return emptyOrgAnalytics({ org, days });
  }

  const now = new Date();
  const dayKeys = lastNDays(days, now);
  const since = new Date(now.getTime() - days * DAY_MS);
  const prevSince = new Date(now.getTime() - 2 * days * DAY_MS);
  const active7 = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);
  const prev7 = new Date(active7.getTime() - 7 * DAY_MS);

  const base = studentFilter(org, studentIds);

  const [
    organization,
    totalStudents,
    activeStudents,
    prevActiveStudents,
    suspendedStudents,
    newStudents,
    prevNewStudents,
    facultyCount,
    classroomCount,
    students,
    levelRows,
    quizActivityRows,
    gameActivityRows,
    signupRows,
    attemptRows,
    worlds,
    lessonCount,
    quizCount,
  ] = await Promise.all([
    Organization.findById(org).select('name code plan seatLimit studentCount facultyCount classroomCount timezone'),
    User.countDocuments(base),
    User.countDocuments({ ...base, updatedAt: { $gte: active7 } }),
    User.countDocuments({ ...base, updatedAt: { $gte: prev7, $lt: active7 } }),
    User.countDocuments({ ...base, status: 'suspended' }),
    User.countDocuments({ ...base, createdAt: { $gte: since } }),
    User.countDocuments({ ...base, createdAt: { $gte: prevSince, $lt: since } }),
    studentIds
      ? Promise.resolve(0)
      : User.countDocuments({ org, role: ROLES.FACULTY, deletedAt: null }),
    studentIds
      ? Promise.resolve(0)
      : Classroom.countDocuments({ org, archivedAt: null }),

    User.find(base)
      .select('name username rollNumber grade xp level coins quizzesPassed gameLevelsCompleted lessonsCompleted completedLessons status createdAt updatedAt')
      .lean(),

    User.aggregate([
      { $match: base },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    // Learning activity, scoped to this org's students.
    (async () => {
      const ids = await resolveStudentIds(base);
      if (!ids.length) return [];
      return QuizAttempt.aggregate([
        { $match: { user: { $in: ids }, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]);
    })(),
    (async () => {
      const ids = await resolveStudentIds(base);
      if (!ids.length) return [];
      return GameScore.aggregate([
        { $match: { user: { $in: ids }, updatedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } },
      ]);
    })(),
    User.aggregate([
      { $match: { ...base, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),

    // Every attempt by this cohort, for mastery + difficulty analysis.
    (async () => {
      const ids = await resolveStudentIds(base);
      if (!ids.length) return [];
      return QuizAttempt.find({ user: { $in: ids } })
        .select('user quiz score total passed createdAt')
        .lean();
    })(),

    World.find().select('name slug order').sort({ order: 1 }).lean(),
    Lesson.countDocuments(),
    Quiz.countDocuments(),
  ]);

  const xpValues = students.map((s) => s.xp || 0);

  /* ---- Best attempt per (student, quiz): the basis for every score stat ---- */
  const bestByStudentQuiz = new Map();
  for (const a of attemptRows) {
    const key = `${a.user}|${a.quiz}`;
    const prev = bestByStudentQuiz.get(key);
    if (!prev || a.score > prev.score) bestByStudentQuiz.set(key, a);
  }
  const bestAttempts = [...bestByStudentQuiz.values()];

  const attemptsByStudent = new Map();
  for (const a of attemptRows) {
    const k = String(a.user);
    attemptsByStudent.set(k, (attemptsByStudent.get(k) || 0) + 1);
  }
  const bestByStudent = new Map();
  for (const a of bestAttempts) {
    const k = String(a.user);
    if (!bestByStudent.has(k)) bestByStudent.set(k, []);
    bestByStudent.get(k).push(a);
  }

  /* ---- Per-quiz difficulty: which quizzes is the cohort failing? ---- */
  const perQuiz = new Map();
  for (const a of bestAttempts) {
    const k = String(a.quiz);
    if (!perQuiz.has(k)) perQuiz.set(k, { attempted: 0, passed: 0, score: 0, total: 0 });
    const row = perQuiz.get(k);
    row.attempted += 1;
    if (a.passed) row.passed += 1;
    row.score += a.score || 0;
    row.total += a.total || 0;
  }
  const quizDocs = await Quiz.find({ _id: { $in: [...perQuiz.keys()] } })
    .select('title lesson')
    .populate('lesson', 'title world')
    .lean();
  const quizById = new Map(quizDocs.map((q) => [String(q._id), q]));

  const quizDifficulty = [...perQuiz.entries()]
    .map(([id, row]) => {
      const q = quizById.get(id);
      return {
        id,
        title: q?.title || 'Quiz',
        attempted: row.attempted,
        passRate: pct(row.passed, row.attempted),
        avgScore: pct(row.score, row.total),
      };
    })
    // Hardest first — this is the "what needs re-teaching" list.
    .sort((a, b) => a.passRate - b.passRate);

  /* ---- Per-student rollup + the at-risk list ---- */
  const studentRows = students.map((s) => {
    const key = String(s._id);
    const best = bestByStudent.get(key) || [];
    const totalAttempts = attemptsByStudent.get(key) || 0;
    const scoreSum = best.reduce((n, a) => n + (a.score || 0), 0);
    const possible = best.reduce((n, a) => n + (a.total || 0), 0);
    const lessonsDone = s.completedLessons?.length || s.lessonsCompleted || 0;
    const daysSinceActive = s.updatedAt
      ? Math.floor((now - new Date(s.updatedAt)) / DAY_MS)
      : null;

    const row = {
      id: key,
      name: s.name,
      username: s.username || null,
      rollNumber: s.rollNumber || null,
      grade: s.grade || '',
      status: s.status,
      level: s.level || 1,
      xp: s.xp || 0,
      coins: s.coins || 0,
      lessonsCompleted: lessonsDone,
      lessonCoverage: pct(lessonsDone, lessonCount),
      gameLevelsCompleted: s.gameLevelsCompleted || 0,
      quizzesAttempted: best.length,
      quizzesPassed: best.filter((a) => a.passed).length,
      quizCoverage: pct(best.length, quizCount),
      avgScore: pct(scoreSum, possible),
      retryRate: best.length ? Number((totalAttempts / best.length).toFixed(2)) : 0,
      daysSinceActive,
    };

    row.attention = attentionReasons(row, { quizCount, lessonCount });
    return row;
  });

  const needingAttention = studentRows
    .filter((r) => r.attention.length > 0)
    .sort((a, b) => b.attention.length - a.attention.length || a.avgScore - b.avgScore);

  /* ---- Mastery per world ---- */
  const lessonsByWorld = await Lesson.aggregate([
    { $group: { _id: '$world', lessons: { $sum: 1 } } },
  ]);
  const lessonsByWorldMap = new Map(lessonsByWorld.map((r) => [String(r._id), r.lessons]));

  const completedByWorld = new Map();
  for (const s of students) {
    for (const c of s.completedLessons || []) {
      if (!c.world) continue;
      const k = String(c.world);
      completedByWorld.set(k, (completedByWorld.get(k) || 0) + 1);
    }
  }

  const worldMastery = worlds.map((w) => {
    const perWorldLessons = lessonsByWorldMap.get(String(w._id)) || 0;
    const possible = perWorldLessons * (totalStudents || 0);
    const done = completedByWorld.get(String(w._id)) || 0;
    return {
      id: String(w._id),
      label: w.name,
      slug: w.slug,
      lessons: perWorldLessons,
      completions: done,
      value: pct(done, possible),
    };
  });

  const topStudents = [...studentRows].sort((a, b) => b.xp - a.xp).slice(0, 10);

  return {
    generatedAt: now,
    window: { days, from: since, to: now },
    organization: organization
      ? {
          id: String(organization._id),
          name: organization.name,
          code: organization.code,
          plan: organization.plan,
          seatLimit: organization.seatLimit || 0,
          seatUtilization: organization.seatLimit
            ? pct(totalStudents, organization.seatLimit)
            : null,
          timezone: organization.timezone,
        }
      : null,
    scope: studentIds ? 'classrooms' : 'organization',

    kpis: {
      students: compare(totalStudents, totalStudents - newStudents + prevNewStudents),
      newStudents: compare(newStudents, prevNewStudents),
      activeStudents: compare(activeStudents, prevActiveStudents),
      faculty: { value: facultyCount, previous: facultyCount, delta: 0, direction: 'flat' },
      classrooms: { value: classroomCount, previous: classroomCount, delta: 0, direction: 'flat' },
      suspended: { value: suspendedStudents, previous: suspendedStudents, delta: 0, direction: 'flat' },
      needingAttention: {
        value: needingAttention.length,
        previous: needingAttention.length,
        delta: 0,
        direction: 'flat',
      },
    },

    engagement: {
      activeStudents,
      engagementRate: pct(activeStudents, totalStudents),
      avgXp: avg(xpValues),
      medianXp: median(xpValues),
      classAverageScore: avg(studentRows.map((r) => r.avgScore)),
      avgLessonCoverage: avg(studentRows.map((r) => r.lessonCoverage)),
      avgQuizCoverage: avg(studentRows.map((r) => r.quizCoverage)),
    },

    series: {
      quizActivity: densify(quizActivityRows, dayKeys, 'date'),
      gameActivity: densify(gameActivityRows, dayKeys, 'date'),
      signups: densify(signupRows, dayKeys, 'date'),
    },

    distributions: {
      level: levelRows.map((r) => ({ label: `L${r._id || 1}`, value: r.count })),
      xp: bucketize(xpValues, XP_BANDS),
      // How recently pupils were last active — the retention read.
      recency: bucketize(
        studentRows.map((r) => (r.daysSinceActive == null ? 9999 : r.daysSinceActive)),
        [
          { label: 'Today', min: 0, max: 1 },
          { label: '1–6 days', min: 1, max: 7 },
          { label: '1–4 weeks', min: 7, max: 30 },
          { label: 'Over a month', min: 30, max: Infinity },
        ]
      ),
    },

    worldMastery,
    quizDifficulty: quizDifficulty.slice(0, 12),
    needingAttention: needingAttention.slice(0, 20),
    topStudents,
  };
}

/** Resolve the concrete student ids matching a filter (cached per call). */
async function resolveStudentIds(filter) {
  const rows = await User.find(filter).select('_id').lean();
  return rows.map((r) => r._id);
}

/**
 * Reasons a student needs a teacher's attention.
 *
 * Deliberately simple and explainable: a teacher has to trust it enough to act
 * on it, so every flag maps to one obvious observation.
 */
export function attentionReasons(row, { quizCount = 0, lessonCount = 0 } = {}) {
  const reasons = [];
  if (row.status === 'suspended') reasons.push('Account suspended');

  const hasStarted = row.quizzesAttempted > 0 || row.lessonsCompleted > 0;
  if (!hasStarted) {
    reasons.push('Not started');
    return reasons;
  }

  if (row.daysSinceActive != null && row.daysSinceActive >= 14) reasons.push('Inactive 2+ weeks');
  if (row.quizzesAttempted > 0 && row.avgScore < 50) reasons.push('Low average score');
  if (row.quizzesAttempted >= 2 && row.quizzesPassed === 0) reasons.push('No quiz passed yet');
  if (row.retryRate >= 3) reasons.push('Many retries');
  if (quizCount > 0 && row.quizCoverage < 25) reasons.push('Far behind on quizzes');
  if (lessonCount > 0 && row.lessonCoverage < 25) reasons.push('Far behind on lessons');
  return reasons;
}

/** A well-formed empty dashboard, for a teacher with no classes yet. */
function emptyOrgAnalytics({ org, days }) {
  const now = new Date();
  const dayKeys = lastNDays(days, now);
  const zero = { value: 0, previous: 0, delta: 0, direction: 'flat' };
  const emptySeries = dayKeys.map((d) => ({ date: d, value: 0 }));
  return {
    generatedAt: now,
    window: { days, from: new Date(now.getTime() - days * DAY_MS), to: now },
    organization: null,
    scope: 'classrooms',
    empty: true,
    emptyReason:
      'You have not been assigned to any classes yet. Ask your administrator to add you to a class.',
    kpis: {
      students: zero,
      newStudents: zero,
      activeStudents: zero,
      faculty: zero,
      classrooms: zero,
      suspended: zero,
      needingAttention: zero,
    },
    engagement: {
      activeStudents: 0,
      engagementRate: 0,
      avgXp: 0,
      medianXp: 0,
      classAverageScore: 0,
      avgLessonCoverage: 0,
      avgQuizCoverage: 0,
    },
    series: { quizActivity: emptySeries, gameActivity: emptySeries, signups: emptySeries },
    distributions: { level: [], xp: [], recency: [] },
    worldMastery: [],
    quizDifficulty: [],
    needingAttention: [],
    topStudents: [],
  };
}

/* ========================================================================== */
/* CLASSROOM ANALYTICS — one class                                            */
/* ========================================================================== */

export async function getClassroomAnalytics({ org, classroomId, classroomScope = null, days = 30 }) {
  const filter = { _id: classroomId, org };
  if (classroomScope) filter._id = { $in: classroomScope, $eq: classroomId };

  const classroom = await Classroom.findOne({ _id: classroomId, org }).select(
    'name grade section subject academicYear students faculty'
  );
  if (!classroom) throw ApiError.notFound('Classroom not found');

  // A faculty member may only see a class they teach.
  if (classroomScope && !classroomScope.some((id) => String(id) === String(classroomId))) {
    throw ApiError.notFound('Classroom not found');
  }

  const studentIds = (classroom.students || []).map(String);
  const analytics = await getOrgAnalytics({ org, studentIds, days });

  return {
    ...analytics,
    scope: 'classroom',
    classroom: {
      id: String(classroom._id),
      name: classroom.name,
      grade: classroom.grade,
      section: classroom.section,
      subject: classroom.subject,
      academicYear: classroom.academicYear,
      studentCount: studentIds.length,
    },
  };
}

export default {
  getPlatformAnalytics,
  getOrgAnalytics,
  getClassroomAnalytics,
  attentionReasons,
};
