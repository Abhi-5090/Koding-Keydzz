import { orgRepository } from '../repositories/orgRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify, generateOrgCode } from '../utils/orgUtils.js';
import { setStudentSuspension, resetStudentPassword } from './adminService.js';
import {
  bulkCreateStudents,
  createStudent as createStudentInOrg,
} from './studentBulkService.js';
import { lastNMonths, fillMonthlySeries, bucketizeXp } from '../utils/analytics.js';
import { World } from '../models/World.js';
import { Lesson } from '../models/Lesson.js';
import { Quiz } from '../models/Quiz.js';
import { Challenge } from '../models/Challenge.js';
import { Achievement } from '../models/Achievement.js';
import { AvatarItem } from '../models/AvatarItem.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';

/**
 * Derive a unique slug and code for an org name, retrying the code on collision.
 */
async function deriveUniqueSlugAndCode(name) {
  const slug = slugify(name);
  if (await orgRepository.findBySlug(slug)) {
    throw ApiError.conflict('An organization with this name already exists');
  }
  let code = generateOrgCode(name);
  // Retry a handful of times in the unlikely event of a code collision.
  for (let i = 0; i < 10 && (await orgRepository.findByCode(code)); i += 1) {
    code = generateOrgCode(name);
  }
  return { slug, code };
}

function adminSafe(user) {
  const obj = user.toSafeJSON ? user.toSafeJSON() : user;
  return { id: String(obj._id), name: obj.name, email: obj.email, role: obj.role };
}

/**
 * Create an organization plus its admin user in a transaction-like flow.
 * If admin creation fails after the org was created, the org is rolled back.
 */
export async function createOrg({ name, adminName, adminEmail, adminPassword }, createdBy = null) {
  const existingOrg = await orgRepository.findByName(name);
  if (existingOrg) {
    throw ApiError.conflict('An organization with this name already exists');
  }
  const existingAdmin = await userRepository.findByEmail(adminEmail);
  if (existingAdmin) {
    throw ApiError.badRequest('An account with this admin email already exists');
  }

  const { slug, code } = await deriveUniqueSlugAndCode(name);

  const org = await orgRepository.create({
    name: name.trim(),
    slug,
    code,
    status: 'active',
    createdBy: createdBy || undefined,
    studentCount: 0,
  });

  let admin;
  try {
    admin = new userRepository.model({
      role: 'admin',
      name: adminName,
      email: adminEmail,
      org: org._id,
    });
    await admin.setPassword(adminPassword);
    await admin.save();
  } catch (err) {
    // Roll back the org so we never leave an org without its admin.
    await orgRepository.deleteById(org._id);
    if (err.code === 11000) {
      throw ApiError.badRequest('An account with this admin email already exists');
    }
    throw err;
  }

  org.adminUser = admin._id;
  await org.save();

  return { org: serializeOrg(org), admin: adminSafe(admin) };
}

function serializeOrg(org, { admin, studentCount } = {}) {
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    code: org.code,
    status: org.status,
    studentCount:
      typeof studentCount === 'number' ? studentCount : org.studentCount || 0,
    admin: admin || null,
    createdAt: org.createdAt,
  };
}

export async function listOrgs() {
  const orgs = await orgRepository.listAll();
  const items = await Promise.all(
    orgs.map(async (org) => {
      const studentCount = await userRepository.count({
        role: 'student',
        org: org._id,
      });
      const adminDoc = org.adminUser;
      const admin = adminDoc
        ? { name: adminDoc.name, email: adminDoc.email }
        : null;
      return serializeOrg(org, { admin, studentCount });
    })
  );
  return { items, total: items.length };
}

export async function getOrg(id) {
  const org = await orgRepository.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');

  const [studentCount, adminUser] = await Promise.all([
    userRepository.count({ role: 'student', org: org._id }),
    org.adminUser ? userRepository.findById(org.adminUser) : null,
  ]);

  const admin = adminUser ? adminSafe(adminUser) : null;
  return {
    ...serializeOrg(org, { admin, studentCount }),
    counts: { students: studentCount, admins: adminUser ? 1 : 0 },
  };
}

export async function updateOrg(id, { name, status }) {
  const org = await orgRepository.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');

  if (name && name.trim() !== org.name) {
    const clash = await orgRepository.findByName(name);
    if (clash && String(clash._id) !== String(org._id)) {
      throw ApiError.conflict('An organization with this name already exists');
    }
    const slug = slugify(name);
    const slugClash = await orgRepository.findBySlug(slug);
    if (slugClash && String(slugClash._id) !== String(org._id)) {
      throw ApiError.conflict('An organization with this name already exists');
    }
    org.name = name.trim();
    org.slug = slug;
  }

  if (status) {
    org.status = status;
    // Suspending an org revokes the sessions of its admin + students so they
    // are forced through login (where the org status is re-checked).
    if (status === 'suspended') {
      await userRepository.model.updateMany(
        { org: org._id },
        { refreshTokenHash: null }
      );
    }
  }

  await org.save();
  return getOrg(org._id);
}

export async function updateOrgAdmin(id, { adminName, adminEmail, adminPassword }) {
  const org = await orgRepository.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');
  if (!org.adminUser) throw ApiError.notFound('Organization has no admin');

  const admin = await userRepository.findById(org.adminUser);
  if (!admin) throw ApiError.notFound('Organization admin not found');

  if (adminEmail && adminEmail.toLowerCase() !== admin.email) {
    const clash = await userRepository.findByEmail(adminEmail);
    if (clash) {
      throw ApiError.badRequest('An account with this admin email already exists');
    }
    admin.email = adminEmail;
  }
  if (adminName) admin.name = adminName;
  if (adminPassword) await admin.setPassword(adminPassword);

  await admin.save();
  return { org: serializeOrg(org), admin: adminSafe(admin) };
}

export async function deleteOrg(id) {
  const org = await orgRepository.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');

  // Cascade: remove the org's admin + all its students.
  const { deletedCount = 0 } = await userRepository.deleteByOrg(org._id);
  await orgRepository.deleteById(org._id);

  return { id: String(org._id), deletedUsers: deletedCount };
}

export async function getStats() {
  const [totalOrgs, activeOrgs, totalAdmins, totalStudents] = await Promise.all([
    orgRepository.count(),
    orgRepository.count({ status: 'active' }),
    userRepository.count({ role: 'admin' }),
    userRepository.count({ role: 'student' }),
  ]);
  return { totalOrgs, activeOrgs, totalAdmins, totalStudents };
}

/* -------------------------------------------------------------------------- */
/* Platform-wide analytics (GOAL 1).                                          */
/* -------------------------------------------------------------------------- */

/** Aggregate document counts created per 'YYYY-MM' since the given date. */
async function monthlyCreatedSeries(model, match, since, months) {
  const rows = await model.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, period: '$_id', count: 1 } },
  ]);
  return fillMonthlySeries(rows, months);
}

export async function getAnalytics() {
  const now = new Date();
  const months = lastNMonths(6, now);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    orgs,
    activeOrgs,
    suspendedOrgs,
    admins,
    students,
    suspendedStudents,
    activeLast7,
    activeLast30,
    studentXps,
    levelRows,
    studentsPerOrgRows,
    xpPerOrgRows,
    studentGrowth,
    orgGrowth,
    worlds,
    lessons,
    quizzes,
    challenges,
    achievements,
    avatarItems,
  ] = await Promise.all([
    Organization.countDocuments(),
    Organization.countDocuments({ status: 'active' }),
    Organization.countDocuments({ status: 'suspended' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', status: 'suspended' }),
    User.countDocuments({ role: 'student', updatedAt: { $gte: last7 } }),
    User.countDocuments({ role: 'student', updatedAt: { $gte: last30 } }),
    User.find({ role: 'student' }).select('xp').lean(),
    User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $project: { _id: 0, level: '$_id', count: 1 } },
      { $sort: { level: 1 } },
    ]),
    User.aggregate([
      { $match: { role: 'student', org: { $ne: null } } },
      { $group: { _id: '$org', students: { $sum: 1 } } },
      {
        $lookup: {
          from: 'organizations',
          localField: '_id',
          foreignField: '_id',
          as: 'org',
        },
      },
      { $unwind: '$org' },
      {
        $project: {
          _id: 0,
          orgId: '$org._id',
          org: '$org.name',
          code: '$org.code',
          students: 1,
        },
      },
      { $sort: { students: -1 } },
    ]),
    User.aggregate([
      { $match: { role: 'student', org: { $ne: null } } },
      { $group: { _id: '$org', totalXp: { $sum: '$xp' } } },
      {
        $lookup: {
          from: 'organizations',
          localField: '_id',
          foreignField: '_id',
          as: 'org',
        },
      },
      { $unwind: '$org' },
      {
        $project: {
          _id: 0,
          org: '$org.name',
          code: '$org.code',
          totalXp: 1,
        },
      },
      { $sort: { totalXp: -1 } },
    ]),
    monthlyCreatedSeries(User, { role: 'student' }, sixMonthsAgo, months),
    monthlyCreatedSeries(Organization, {}, sixMonthsAgo, months),
    World.countDocuments(),
    Lesson.countDocuments(),
    Quiz.countDocuments(),
    Challenge.countDocuments(),
    Achievement.countDocuments(),
    AvatarItem.countDocuments(),
  ]);

  return {
    totals: {
      orgs,
      activeOrgs,
      suspendedOrgs,
      admins,
      students,
      suspendedStudents,
    },
    growth: { students: studentGrowth, orgs: orgGrowth },
    studentsPerOrg: studentsPerOrgRows.map((r) => ({
      orgId: String(r.orgId),
      org: r.org,
      code: r.code,
      students: r.students,
    })),
    xpDistribution: bucketizeXp(studentXps.map((s) => s.xp || 0)),
    levelDistribution: levelRows,
    activeUsers: { last7: activeLast7, last30: activeLast30 },
    topOrgsByStudents: studentsPerOrgRows
      .slice(0, 5)
      .map(({ org, code, students }) => ({ org, code, students })),
    topOrgsByXp: xpPerOrgRows.slice(0, 5),
    contentCounts: { worlds, lessons, quizzes, challenges, achievements, avatarItems },
  };
}

/* -------------------------------------------------------------------------- */
/* Global student management (GOAL 2). Platform-wide, not org-bound.          */
/* -------------------------------------------------------------------------- */

export async function listAllStudents({ search = '', org = null, page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const filter = { role: 'student' };
  if (org) filter.org = org;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
    ];
  }

  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('org', 'name code'),
    User.countDocuments(filter),
  ]);

  const items = docs.map((u) => {
    const safe = u.toSafeJSON();
    const orgDoc = u.org && typeof u.org === 'object' ? u.org : null;
    return {
      ...safe,
      org: orgDoc
        ? { id: String(orgDoc._id), name: orgDoc.name, code: orgDoc.code }
        : null,
    };
  });

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.ceil(total / safeLimit) || 1,
  };
}

// Global suspend/reset reuse the org-agnostic adminService helpers (org=null).
export async function suspendStudentGlobal(id, suspend = true) {
  return setStudentSuspension(id, suspend, null);
}

export async function resetStudentPasswordGlobal(id, password = null) {
  return resetStudentPassword(id, password, null);
}

/* -------------------------------------------------------------------------- */
/* Per-org student management (drill into a chosen org).                      */
/* -------------------------------------------------------------------------- */

/** Ensure the org exists; returns the doc or throws 404. */
async function requireOrgById(id) {
  const org = await orgRepository.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

/** List students in a specific org (paginated/searchable). 404 if org missing. */
export async function listOrgStudents(orgId, { search = '', page = 1, limit = 20 } = {}) {
  await requireOrgById(orgId);
  return listAllStudents({ search, org: orgId, page, limit });
}

/** Bulk-create students into a specific org using one common password. */
export async function bulkCreateOrgStudents(orgId, buffer, commonPassword) {
  await requireOrgById(orgId);
  return bulkCreateStudents(buffer, { org: orgId, commonPassword });
}

/** Create a single student into a specific org. */
export async function createOrgStudent(orgId, payload) {
  await requireOrgById(orgId);
  return createStudentInOrg(payload, orgId);
}

export default {
  createOrg,
  listOrgs,
  getOrg,
  updateOrg,
  updateOrgAdmin,
  deleteOrg,
  getStats,
  getAnalytics,
  listAllStudents,
  suspendStudentGlobal,
  resetStudentPasswordGlobal,
  listOrgStudents,
  bulkCreateOrgStudents,
  createOrgStudent,
};
