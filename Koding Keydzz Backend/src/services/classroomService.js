import { Classroom } from '../models/Classroom.js';
import { Organization } from '../models/Organization.js';
import { userRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/privacy.js';
import { ROLES } from '../config/permissions.js';

/**
 * Classroom management.
 *
 * A classroom is what makes faculty permissions meaningful: it links a set of
 * teachers to a set of students inside one organization. Before it existed, a
 * teacher could only be given the entire school or nothing.
 *
 * SCOPING CONTRACT
 * ----------------
 * Every function takes `org` (the tenant) and an optional `classroomScope`:
 *
 *   classroomScope = null        the caller sees all classes in the org (admin)
 *   classroomScope = ObjectId[]  the caller sees only these classes (faculty)
 *
 * `req.classroomScope` is populated by the withClassroomScope middleware, so
 * routes just pass it through.
 */

/**
 * Apply the caller's classroom scope to a LIST filter.
 *
 * Only safe when the filter does not already constrain `_id` — see
 * assertInScope() for the single-document case, where naively spreading
 * `_id: { $in: scope }` over an explicit `_id` silently DROPS the requested id
 * and turns "get class X" into "get any class I teach".
 */
function scopedList(filter, classroomScope) {
  if (!classroomScope) return filter;
  return { ...filter, _id: { $in: classroomScope } };
}

/**
 * Guard a single-classroom operation against the caller's scope.
 *
 * Throws 404 (never 403 — a class the caller may not see must be
 * indistinguishable from one that does not exist) when a faculty member asks
 * for a class they do not teach.
 */
function assertInScope(id, classroomScope) {
  if (!classroomScope) return; // unrestricted (admin / superadmin)
  const allowed = classroomScope.some((cid) => String(cid) === String(id));
  if (!allowed) throw ApiError.notFound('Classroom not found');
}

function toJSON(c, extra = {}) {
  return {
    id: String(c._id),
    name: c.name,
    grade: c.grade || '',
    section: c.section || '',
    subject: c.subject || '',
    academicYear: c.academicYear || '',
    studentCount: c.students?.length || 0,
    facultyCount: c.faculty?.length || 0,
    archived: Boolean(c.archivedAt),
    createdAt: c.createdAt,
    ...extra,
  };
}

/** List classrooms in an organization, narrowed to the caller's scope. */
export async function listClassrooms({
  org,
  classroomScope = null,
  search = '',
  includeArchived = false,
} = {}) {
  if (!org) throw ApiError.badRequest('An organization is required');

  const filter = { org };
  if (!includeArchived) filter.archivedAt = null;
  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { grade: { $regex: safe, $options: 'i' } },
      { section: { $regex: safe, $options: 'i' } },
      { subject: { $regex: safe, $options: 'i' } },
    ];
  }

  const rows = await Classroom.find(scopedList(filter, classroomScope))
    .sort({ grade: 1, section: 1, name: 1 })
    .populate('faculty', 'name email title');

  return {
    items: rows.map((c) =>
      toJSON(c, {
        faculty: (c.faculty || []).map((f) => ({
          id: String(f._id),
          name: f.name,
          email: f.email || null,
          title: f.title || '',
        })),
      })
    ),
    total: rows.length,
  };
}

/** One classroom with its full roster. */
export async function getClassroom({ org, id, classroomScope = null }) {
  assertInScope(id, classroomScope);
  const c = await Classroom.findOne({ _id: id, org })
    .populate('faculty', 'name email title subjects')
    .populate('students', 'name username rollNumber grade xp level coins status quizzesPassed gameLevelsCompleted lessonsCompleted updatedAt');

  if (!c) throw ApiError.notFound('Classroom not found');

  return toJSON(c, {
    faculty: (c.faculty || []).map((f) => ({
      id: String(f._id),
      name: f.name,
      email: f.email || null,
      title: f.title || '',
      subjects: f.subjects || [],
    })),
    students: (c.students || [])
      .filter((s) => s && !s.deletedAt)
      .map((s) => ({
        id: String(s._id),
        name: s.name,
        username: s.username || null,
        rollNumber: s.rollNumber || null,
        grade: s.grade || '',
        xp: s.xp || 0,
        level: s.level || 1,
        coins: s.coins || 0,
        status: s.status,
        quizzesPassed: s.quizzesPassed || 0,
        gameLevelsCompleted: s.gameLevelsCompleted || 0,
        lessonsCompleted: s.lessonsCompleted || 0,
        lastActiveAt: s.updatedAt,
      })),
  });
}

/**
 * Validate that a set of user ids all belong to this organization and hold the
 * expected role. This is the check that stops a classroom from being used to
 * pull in a student — or a teacher — from another school.
 */
async function assertOrgMembers(org, ids, role) {
  const unique = [...new Set((ids || []).map(String))];
  if (!unique.length) return [];

  const found = await userRepository.model
    .find({ _id: { $in: unique }, org, role, deletedAt: null })
    .select('_id');

  if (found.length !== unique.length) {
    const foundSet = new Set(found.map((u) => String(u._id)));
    const missing = unique.filter((id) => !foundSet.has(id));
    throw ApiError.badRequest(
      `${missing.length} ${role}${missing.length === 1 ? '' : 's'} could not be found in this organization`
    );
  }
  return found.map((u) => u._id);
}

export async function createClassroom({
  org,
  name,
  grade = '',
  section = '',
  subject = '',
  academicYear = '',
  faculty = [],
  students = [],
  createdBy = null,
}) {
  if (!org) throw ApiError.badRequest('An organization is required');
  if (!String(name || '').trim()) throw ApiError.badRequest('A class name is required');

  const [facultyIds, studentIds] = await Promise.all([
    assertOrgMembers(org, faculty, ROLES.FACULTY),
    assertOrgMembers(org, students, ROLES.STUDENT),
  ]);

  try {
    const c = await Classroom.create({
      org,
      name: String(name).trim(),
      grade: String(grade || '').trim(),
      section: String(section || '').trim(),
      subject: String(subject || '').trim(),
      academicYear: String(academicYear || '').trim(),
      faculty: facultyIds,
      students: studentIds,
      createdBy: createdBy || undefined,
    });
    await Organization.recountMembers(org);
    return toJSON(c);
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict(
        'A class with this name already exists for this academic year'
      );
    }
    throw err;
  }
}

export async function updateClassroom({ org, id, patch = {}, classroomScope = null }) {
  assertInScope(id, classroomScope);
  const c = await Classroom.findOne({ _id: id, org });
  if (!c) throw ApiError.notFound('Classroom not found');

  if (patch.name !== undefined) c.name = String(patch.name).trim();
  if (patch.grade !== undefined) c.grade = String(patch.grade || '').trim();
  if (patch.section !== undefined) c.section = String(patch.section || '').trim();
  if (patch.subject !== undefined) c.subject = String(patch.subject || '').trim();
  if (patch.academicYear !== undefined) {
    c.academicYear = String(patch.academicYear || '').trim();
  }

  if (patch.faculty !== undefined) {
    c.faculty = await assertOrgMembers(org, patch.faculty, ROLES.FACULTY);
  }
  if (patch.students !== undefined) {
    c.students = await assertOrgMembers(org, patch.students, ROLES.STUDENT);
  }

  try {
    await c.save();
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('A class with this name already exists for this academic year');
    }
    throw err;
  }
  return toJSON(c);
}

/**
 * Add or remove students from a roster.
 *
 * Faculty may do this for their own classes (capability
 * 'classroom:manage_roster') without being able to create or delete classes.
 */
export async function updateRoster({ org, id, add = [], remove = [], classroomScope = null }) {
  assertInScope(id, classroomScope);
  const c = await Classroom.findOne({ _id: id, org });
  if (!c) throw ApiError.notFound('Classroom not found');

  if (add.length) {
    const addIds = await assertOrgMembers(org, add, ROLES.STUDENT);
    const existing = new Set((c.students || []).map(String));
    for (const sid of addIds) {
      if (!existing.has(String(sid))) c.students.push(sid);
    }
  }

  if (remove.length) {
    const removeSet = new Set(remove.map(String));
    c.students = (c.students || []).filter((s) => !removeSet.has(String(s)));
  }

  await c.save();
  return toJSON(c);
}

/** Assign or unassign teachers. Admin-only (capability 'classroom:write'). */
export async function updateFaculty({ org, id, add = [], remove = [] }) {
  const c = await Classroom.findOne({ _id: id, org });
  if (!c) throw ApiError.notFound('Classroom not found');

  if (add.length) {
    const addIds = await assertOrgMembers(org, add, ROLES.FACULTY);
    const existing = new Set((c.faculty || []).map(String));
    for (const fid of addIds) {
      if (!existing.has(String(fid))) c.faculty.push(fid);
    }
  }
  if (remove.length) {
    const removeSet = new Set(remove.map(String));
    c.faculty = (c.faculty || []).filter((f) => !removeSet.has(String(f)));
  }

  await c.save();
  return toJSON(c);
}

/**
 * Archive rather than delete, so the class and the reports built on it survive
 * the roll-over into a new academic year.
 */
export async function archiveClassroom({ org, id, archive = true }) {
  const c = await Classroom.findOne({ _id: id, org });
  if (!c) throw ApiError.notFound('Classroom not found');
  c.archivedAt = archive ? new Date() : null;
  await c.save();
  await Organization.recountMembers(org);
  return toJSON(c);
}

/**
 * Resolve the student ids a caller may see.
 *
 * Returns null for an unrestricted caller (admin/superadmin) and an array of
 * ids for a faculty member. This is the primitive the student and report
 * services use so "faculty see only their own students" is enforced in one
 * place rather than re-derived at every call site.
 */
export async function studentIdsInScope({ org, classroomScope }) {
  if (!classroomScope) return null;
  if (!classroomScope.length) return [];

  const rows = await Classroom.find({
    _id: { $in: classroomScope },
    org,
  }).select('students');

  const ids = new Set();
  for (const c of rows) {
    for (const s of c.students || []) ids.add(String(s));
  }
  return [...ids];
}

export default {
  listClassrooms,
  getClassroom,
  createClassroom,
  updateClassroom,
  updateRoster,
  updateFaculty,
  archiveClassroom,
  studentIdsInScope,
};
