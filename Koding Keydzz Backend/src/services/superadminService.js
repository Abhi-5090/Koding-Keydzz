import { orgRepository } from '../repositories/orgRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify, generateOrgCode } from '../utils/orgUtils.js';
import {
  setStudentSuspension,
  resetStudentPassword,
  updateStudent,
  deleteStudent,
  getStudentDetail as getStudentDetailScoped,
} from './adminService.js';
import {
  bulkCreateStudents,
  createStudent as createStudentInOrg,
} from './studentBulkService.js';
import { broadcast } from './notificationService.js';
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
  /**
   * Each retry must actually try something DIFFERENT.
   *
   * This loop used to re-call `generateOrgCode(name)` with no variation. That
   * call is deterministic for any name of six or more alphanumerics, so all
   * ten attempts returned the identical colliding code and the duplicate went
   * to the database — which rejected it with a raw "Duplicate value for code".
   * A school could not onboard its second campus, and the message gave no clue
   * why. Widening the random tail on each pass makes the retry real.
   */
  for (let i = 0; i < 12 && (await orgRepository.findByCode(code)); i += 1) {
    code = generateOrgCode(name, 6, { randomChars: Math.min(2 + i, 5) });
  }

  if (await orgRepository.findByCode(code)) {
    // Astronomically unlikely, but better a sentence the reader can act on
    // than a database error surfacing in the UI.
    throw ApiError.conflict(
      'Could not allocate a unique code for this organization. Please try a slightly different name.'
    );
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
export async function createOrg(
  { name, adminName, adminEmail, adminPassword, ...contract },
  createdBy = null
) {
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
    facultyCount: 0,
    adminCount: 1,
    classroomCount: 0,
    // Optional contract/contact details from the create form.
    ...(contract.plan ? { plan: contract.plan } : {}),
    ...(contract.seatLimit !== undefined ? { seatLimit: contract.seatLimit } : {}),
    ...(contract.contactName ? { contactName: contract.contactName } : {}),
    ...(contract.contactEmail ? { contactEmail: contract.contactEmail } : {}),
    ...(contract.contactPhone ? { contactPhone: contract.contactPhone } : {}),
    ...(contract.city ? { city: contract.city } : {}),
    ...(contract.country ? { country: contract.country } : {}),
    ...(contract.timezone ? { timezone: contract.timezone } : {}),
    ...(contract.notes ? { notes: contract.notes } : {}),
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

function serializeOrg(org, { admin, studentCount, facultyCount, adminCount, classroomCount } = {}) {
  const students =
    typeof studentCount === 'number' ? studentCount : org.studentCount || 0;
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    code: org.code,
    status: org.status,
    studentCount: students,
    // Member counts for the new tenancy model: an organization has MANY
    // admins and faculty, not a single admin.
    facultyCount: typeof facultyCount === 'number' ? facultyCount : org.facultyCount || 0,
    adminCount: typeof adminCount === 'number' ? adminCount : org.adminCount || 0,
    classroomCount:
      typeof classroomCount === 'number' ? classroomCount : org.classroomCount || 0,
    // Contract details surfaced in the superadmin console.
    plan: org.plan || 'trial',
    seatLimit: org.seatLimit || 0,
    seatsRemaining: org.seatLimit ? Math.max(0, org.seatLimit - students) : null,
    seatUtilization: org.seatLimit ? Math.round((students / org.seatLimit) * 100) : null,
    contactName: org.contactName || '',
    contactEmail: org.contactEmail || '',
    contactPhone: org.contactPhone || '',
    city: org.city || '',
    country: org.country || '',
    timezone: org.timezone || '',
    notes: org.notes || '',
    // Primary contact admin (the org may have others).
    admin: admin || null,
    createdAt: org.createdAt,
  };
}

export async function listOrgs() {
  const orgs = await orgRepository.listAll();

  // One grouped query for every org's member counts instead of N queries in a
  // loop — this list is the superadmin's landing page.
  const counts = await User.aggregate([
    { $match: { org: { $ne: null }, deletedAt: null } },
    { $group: { _id: { org: '$org', role: '$role' }, count: { $sum: 1 } } },
  ]);
  const byOrg = new Map();
  for (const row of counts) {
    const key = String(row._id.org);
    if (!byOrg.has(key)) byOrg.set(key, {});
    byOrg.get(key)[row._id.role] = row.count;
  }

  const items = orgs.map((org) => {
    const c = byOrg.get(String(org._id)) || {};
    const adminDoc = org.adminUser;
    const admin = adminDoc ? { name: adminDoc.name, email: adminDoc.email } : null;
    return serializeOrg(org, {
      admin,
      studentCount: c.student || 0,
      facultyCount: c.faculty || 0,
      adminCount: c.admin || 0,
    });
  });

  return { items, total: items.length };
}

export async function getOrg(id) {
  const org = await orgRepository.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');

  const { Classroom } = await import('../models/Classroom.js');
  const [studentCount, facultyCount, adminCount, classroomCount, adminUser, admins] =
    await Promise.all([
      userRepository.count({ role: 'student', org: org._id, deletedAt: null }),
      userRepository.count({ role: 'faculty', org: org._id, deletedAt: null }),
      userRepository.count({ role: 'admin', org: org._id, deletedAt: null }),
      Classroom.countDocuments({ org: org._id, archivedAt: null }),
      org.adminUser ? userRepository.findById(org.adminUser) : null,
      // ALL administrators, not just the primary contact.
      userRepository.model
        .find({ role: 'admin', org: org._id, deletedAt: null })
        .select('name email status lastLoginAt'),
    ]);

  const admin = adminUser ? adminSafe(adminUser) : null;
  return {
    ...serializeOrg(org, {
      admin,
      studentCount,
      facultyCount,
      adminCount,
      classroomCount,
    }),
    counts: {
      students: studentCount,
      faculty: facultyCount,
      admins: adminCount,
      classrooms: classroomCount,
    },
    admins: admins.map((a) => ({
      id: String(a._id),
      name: a.name,
      email: a.email || null,
      status: a.status,
      lastLoginAt: a.lastLoginAt || null,
      isPrimary: String(a._id) === String(org.adminUser || ''),
    })),
  };
}

export async function updateOrg(id, { name, status, ...rest }) {
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
      // Clear BOTH the multi-device session list and the legacy single-hash
      // field, or a signed-in device would survive the suspension.
      await userRepository.model.updateMany(
        { org: org._id },
        { sessions: [], refreshTokenHash: null }
      );
    }
  }

  // Contract / contact fields. Only assign what was actually supplied so a
  // partial update never blanks a field it did not mention.
  for (const field of [
    'plan',
    'seatLimit',
    'contactName',
    'contactEmail',
    'contactPhone',
    'city',
    'country',
    'timezone',
    'notes',
  ]) {
    if (rest[field] !== undefined) org[field] = rest[field];
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
  // deletedAt: null everywhere — soft-deleted accounts must not inflate a
  // headline count. Faculty is counted separately now that the role exists.
  const [totalOrgs, activeOrgs, totalAdmins, totalFaculty, totalStudents] =
    await Promise.all([
      orgRepository.count(),
      orgRepository.count({ status: 'active' }),
      userRepository.count({ role: 'admin', deletedAt: null }),
      userRepository.count({ role: 'faculty', deletedAt: null }),
      userRepository.count({ role: 'student', deletedAt: null }),
    ]);
  return { totalOrgs, activeOrgs, totalAdmins, totalFaculty, totalStudents };
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

// A single student's profile + progress, any org (superadmin is unscoped).
export async function getStudentDetail(id) {
  return getStudentDetailScoped(id, null);
}

// Global suspend/reset reuse the org-agnostic adminService helpers (org=null).
export async function suspendStudentGlobal(id, suspend = true) {
  return setStudentSuspension(id, suspend, null);
}

export async function resetStudentPasswordGlobal(id, password = null) {
  return resetStudentPassword(id, password, null);
}

export async function updateStudentGlobal(id, patch = {}) {
  return updateStudent(id, patch, null);
}

export async function deleteStudentGlobal(id) {
  return deleteStudent(id, null);
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

/** A specific org's student — 404 if the org is missing or the student isn't in it. */
export async function getOrgStudentDetail(orgId, studentId) {
  await requireOrgById(orgId);
  return getStudentDetailScoped(studentId, orgId);
}


/**
 * Platform-wide announcement, or one targeted at a single organization.
 *
 * This is the ONLY unscoped broadcast in the system and it is deliberately
 * restricted to superadmin. Org admins use adminService.broadcastNotification,
 * which is hard-scoped to their own tenant.
 *
 * @param {object} args
 * @param {string} args.title
 * @param {string} [args.body]
 * @param {'all'|'students'} [args.scope]
 * @param {*} [args.org]  When supplied, limits delivery to that organization.
 */
export async function broadcastPlatform({ title, body, scope = 'all', org = null }) {
  const filter = { status: 'active' };
  if (scope === 'students') filter.role = 'student';
  if (org) filter.org = org;

  const users = await userRepository.find(filter, { select: '_id' });
  const userIds = users.map((u) => u._id);

  const result = await broadcast({ type: 'broadcast', title, body, userIds });
  return { ...result, scope, org: org ? String(org) : null };
}

/* -------------------------------------------------------------------------- */
/* Organization assignment — every user belongs to a school.                  */
/* -------------------------------------------------------------------------- */

/**
 * List users who belong to NO organization.
 *
 * WHY THIS EXISTS
 * ---------------
 * `User.org` defaults to `null`, and public self-registration
 * (`POST /auth/register`, gated by ALLOW_STUDENT_SIGNUP) never set it. Any
 * account created that way is a tenant orphan: no school owns it, so no admin
 * can see it, it appears on no classroom, and it is scoped out of every
 * org-filtered query — including the ones that decide what a teacher is shown.
 * The pupil can still sign in, which is what makes it easy to miss.
 *
 * `superadmin` is excluded because being org-less is CORRECT for that role —
 * it is the platform operator, deliberately above every tenant.
 */
export async function listUnassignedUsers({ search = '', page = 1, limit = 25 } = {}) {
  const filter = {
    org: null,
    role: { $ne: 'superadmin' },
    deletedAt: null,
  };
  if (search) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { username: rx }];
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [docs, total] = await Promise.all([
    User.find(filter)
      .select('name firstName lastName email username role grade createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: docs.map((u) => ({
      id: String(u._id),
      name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email || '',
      username: u.username || '',
      role: u.role,
      grade: u.grade || '',
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || null,
    })),
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Put a user into an organization, or move them between organizations.
 *
 * THE SIDE EFFECTS THAT MAKE THIS MORE THAN A FIELD WRITE
 * -------------------------------------------------------
 * `org` is the tenant boundary, so changing it re-homes everything scoped by
 * it. Writing the field alone would leave the account visible in two schools
 * at once:
 *
 *  1. CLASSROOMS. Membership lives on the Classroom document, which carries
 *     its own `org`. A pupil moved to a new school while still listed on their
 *     old school's class roster would keep appearing in that teacher's lists
 *     and analytics — a cross-tenant data leak. They are pulled from every
 *     classroom in the previous org (as student AND as faculty).
 *  2. ROLL NUMBER. `(org, rollNumber)` is uniquely indexed, so a pupil whose
 *     roll number is already taken in the destination would fail the write
 *     with a raw E11000. Detected up front and reported in plain language.
 *  3. SEAT LIMIT. A school on a seat-limited plan must not be pushed over it
 *     by a move it did not ask for.
 *
 * Member counts need no fixup: they are aggregated live from User (see
 * `listOrgs`), never incremented by hand.
 *
 * @param {string} userId
 * @param {string} orgId
 * @returns {Promise<{ id, name, role, from, to, classroomsLeft }>}
 */
export async function assignUserOrganization(userId, orgId) {
  const user = await userRepository.findById(userId);
  if (!user || user.deletedAt) throw ApiError.notFound('User not found');

  // The platform operator is org-less on purpose; giving it a tenant would
  // scope its own queries and lock it out of every other school.
  if (user.role === 'superadmin') {
    throw ApiError.badRequest(
      'The superadmin account is not part of any organization and cannot be assigned to one'
    );
  }

  const org = await requireOrgById(orgId);
  if (org.status && org.status !== 'active') {
    throw ApiError.badRequest(
      `${org.name} is ${org.status}. Reactivate it before moving people into it.`
    );
  }

  const previousOrg = user.org ? String(user.org) : null;
  if (previousOrg === String(org._id)) {
    throw ApiError.badRequest(`This user is already in ${org.name}`);
  }

  // ---- roll number collision in the destination ----
  if (user.rollNumber) {
    const clash = await User.findOne({
      org: org._id,
      rollNumber: user.rollNumber,
      deletedAt: null,
      _id: { $ne: user._id },
    })
      .select('name')
      .lean();
    if (clash) {
      throw ApiError.conflict(
        `Roll number "${user.rollNumber}" is already used by ${clash.name} in ${org.name}. ` +
          "Clear or change this user's roll number first."
      );
    }
  }

  // ---- seat limit on the destination ----
  if (user.role === 'student' && org.seatLimit) {
    const seatsUsed = await User.countDocuments({
      org: org._id,
      role: 'student',
      deletedAt: null,
    });
    if (seatsUsed >= org.seatLimit) {
      throw ApiError.badRequest(
        `${org.name} has no seats left (${seatsUsed} of ${org.seatLimit} used). ` +
          'Raise the seat limit before moving another pupil in.'
      );
    }
  }

  // ---- leave the previous school's classrooms ----
  // Done BEFORE the org write, so a failure here cannot leave the user
  // re-homed but still on the old roster.
  let classroomsLeft = 0;
  if (previousOrg) {
    const { Classroom } = await import('../models/Classroom.js');
    const res = await Classroom.updateMany(
      { org: previousOrg, $or: [{ students: user._id }, { faculty: user._id }] },
      { $pull: { students: user._id, faculty: user._id } }
    );
    classroomsLeft = res.modifiedCount ?? res.nModified ?? 0;
  }

  user.org = org._id;
  await user.save();

  return {
    id: String(user._id),
    name: user.name,
    role: user.role,
    from: previousOrg,
    to: { id: String(org._id), name: org.name, code: org.code },
    classroomsLeft,
  };
}

export default {
  broadcastPlatform,
  createOrg,
  listOrgs,
  getOrg,
  updateOrg,
  updateOrgAdmin,
  deleteOrg,
  getStats,
  getAnalytics,
  listAllStudents,
  getStudentDetail,
  suspendStudentGlobal,
  resetStudentPasswordGlobal,
  updateStudentGlobal,
  deleteStudentGlobal,
  listOrgStudents,
  bulkCreateOrgStudents,
  createOrgStudent,
  getOrgStudentDetail,
  listUnassignedUsers,
  assignUserOrganization,
};
