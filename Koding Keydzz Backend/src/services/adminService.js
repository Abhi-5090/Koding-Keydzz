import { userRepository } from '../repositories/userRepository.js';
import { courseRepository } from '../repositories/courseRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { challengeRepository } from '../repositories/challengeRepository.js';
import { achievementRepository } from '../repositories/achievementRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { buildCsv } from '../utils/csv.js';
import { broadcast } from './notificationService.js';

const ACTIVE_WINDOW_DAYS = 7;

// Readable word pool for generated student passwords (avoids ambiguous words).
const PASSWORD_WORDS = [
  'Tiger', 'Comet', 'Maple', 'River', 'Pixel', 'Mango', 'Robot', 'Cloud',
  'Falcon', 'Cedar', 'Orbit', 'Lemon', 'Panda', 'Nova', 'Coral', 'Ember',
];

/**
 * Generate a readable random password in a Word+digits style, e.g. "Maple4827".
 * Always at least 6 characters. Pure (no DB/network).
 */
export function generatePassword() {
  const word = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000)); // 4 digits, 1000-9999
  return `${word}${digits}`;
}

export async function getStats(org = null) {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const base = { role: 'student' };
  if (org) base.org = org;

  const [totalStudents, activeStudents, totalLessons, students] = await Promise.all([
    userRepository.count(base),
    userRepository.count({ ...base, updatedAt: { $gte: since } }),
    lessonRepository.count(),
    userRepository.find(base, { select: 'xp level completedLessons' }),
  ]);

  // Completion rate: average of (completed lessons / total lessons) across students.
  let completionRate = 0;
  if (totalStudents > 0 && totalLessons > 0) {
    const sum = students.reduce(
      (acc, s) => acc + (s.completedLessons?.length || 0) / totalLessons,
      0
    );
    completionRate = Math.round((sum / totalStudents) * 100);
  }

  // XP distribution buckets.
  const buckets = [
    { label: '0-499', min: 0, max: 500, count: 0 },
    { label: '500-1999', min: 500, max: 2000, count: 0 },
    { label: '2000-4999', min: 2000, max: 5000, count: 0 },
    { label: '5000-9999', min: 5000, max: 10000, count: 0 },
    { label: '10000+', min: 10000, max: Infinity, count: 0 },
  ];
  students.forEach((s) => {
    const xp = s.xp || 0;
    const b = buckets.find((bk) => xp >= bk.min && xp < bk.max);
    if (b) b.count += 1;
  });

  return {
    totalStudents,
    activeStudents,
    completionRate,
    xpDistribution: buckets.map(({ label, count }) => ({ label, count })),
  };
}

export async function listStudents({ search = '', page = 1, limit = 20, org = null } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const countFilter = { role: 'student' };
  if (org) countFilter.org = org;
  if (search) {
    countFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { school: { $regex: search, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    userRepository.searchStudents({ search, skip, limit, org }),
    userRepository.count(countFilter),
  ]);

  return {
    items: items.map((u) => u.toSafeJSON()),
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function setStudentSuspension(id, suspend = true, org = null) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('Student not found');
  // Org-scoping guard: an admin may only touch students in their own org.
  if (org && String(user.org) !== String(org)) {
    throw ApiError.notFound('Student not found');
  }
  user.status = suspend ? 'suspended' : 'active';
  if (suspend) user.refreshTokenHash = null;
  await user.save();
  return user.toSafeJSON();
}

export async function resetStudentPassword(id, password = null, org = null) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('Student not found');
  // Org-scoping guard: an admin may only touch students in their own org.
  if (user.role !== 'student' || (org && String(user.org) !== String(org))) {
    throw ApiError.notFound('Student not found');
  }
  const finalPassword = password || generatePassword();
  await user.setPassword(finalPassword);
  user.refreshTokenHash = null; // invalidate the student's existing session
  await user.save();
  return {
    student: { id: String(user._id), name: user.name, email: user.email },
    password: finalPassword,
  };
}

const ROSTER_HEADERS = [
  'name',
  'grade',
  'school',
  'email',
  'xp',
  'level',
  'coins',
  'status',
  'createdAt',
];

export async function exportRoster(org) {
  const [students, organization] = await Promise.all([
    userRepository.findAllStudentsInOrg(org),
    orgRepository.findById(org),
  ]);

  const rows = students.map((s) => [
    s.name,
    s.grade,
    s.school,
    s.email,
    s.xp ?? 0,
    s.level ?? 1,
    s.coins ?? 0,
    s.status,
    s.createdAt ? s.createdAt.toISOString() : '',
  ]);

  const csv = buildCsv(ROSTER_HEADERS, rows);
  const base = organization?.slug || organization?.code || 'org';
  const filename = `${base}_students.csv`;
  return { csv, filename };
}

/* ---------- Generic CRUD helpers used by admin controllers ---------- */

function makeCrud(repo, notFoundLabel) {
  return {
    list: () => repo.find({}, { sort: { createdAt: -1 } }),
    get: async (id) => {
      const doc = await repo.findById(id);
      if (!doc) throw ApiError.notFound(`${notFoundLabel} not found`);
      return doc;
    },
    create: (data) => repo.create(data),
    update: async (id, data) => {
      const doc = await repo.updateById(id, data);
      if (!doc) throw ApiError.notFound(`${notFoundLabel} not found`);
      return doc;
    },
    remove: async (id) => {
      const doc = await repo.deleteById(id);
      if (!doc) throw ApiError.notFound(`${notFoundLabel} not found`);
      return { id };
    },
  };
}

export const coursesCrud = makeCrud(courseRepository, 'Course');
export const lessonsCrud = makeCrud(lessonRepository, 'Lesson');
export const challengesCrud = makeCrud(challengeRepository, 'Challenge');
export const achievementsCrud = makeCrud(achievementRepository, 'Achievement');

export async function broadcastNotification({ title, body, scope = 'all' }) {
  let userIds = [];
  if (scope === 'students') {
    const students = await userRepository.find(
      { role: 'student', status: 'active' },
      { select: '_id' }
    );
    userIds = students.map((s) => s._id);
  } else if (scope === 'all') {
    const users = await userRepository.find({ status: 'active' }, { select: '_id' });
    userIds = users.map((u) => u._id);
  }
  return broadcast({ type: 'broadcast', title, body, userIds });
}

export default {
  getStats,
  listStudents,
  setStudentSuspension,
  resetStudentPassword,
  exportRoster,
  generatePassword,
  coursesCrud,
  lessonsCrud,
  challengesCrud,
  achievementsCrud,
  broadcastNotification,
};
