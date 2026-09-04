import { userRepository } from '../repositories/userRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { Organization } from '../models/Organization.js';
import { Classroom } from '../models/Classroom.js';
import {
  sendMail,
  mailEnabled,
  staffWelcomeMessage,
  config as mailConfig,
} from './mailService.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/privacy.js';
import { generatePassword } from './adminService.js';
import { ROLES } from '../config/permissions.js';

/**
 * Organization staff management — admins and faculty.
 *
 * WHY THIS EXISTS
 * ---------------
 * An organization previously got exactly ONE admin, created inline when the
 * superadmin created the org, with no endpoint to add another and no concept
 * of a teacher at all. This service provides the missing half of the tenancy
 * model: a school administrator can invite co-administrators and faculty, and
 * faculty can be assigned to classrooms.
 *
 * Every function takes `org` and filters on it. Passing a null `org` is only
 * valid for the superadmin, which is enforced by the routes.
 */

/**
 * ROLES AN ADMINISTRATOR MANAGES FROM THE STAFF PAGE.
 *
 * NOT the same list as `STAFF_ROLES` in config/permissions.js, and the
 * difference matters:
 *
 *   • permissions.STAFF_ROLES = who may see OTHER PEOPLE'S data
 *     (superadmin, admin, faculty). A guardian is emphatically not in it.
 *   • this list = whose ACCOUNT an administrator provisions and maintains here
 *     (admin, faculty, guardian).
 *
 * A parent account is created exactly like a member of staff — by the school,
 * with a temporary password, forced to change it on first sign-in — and needs
 * to appear on this roster so the office can find it, reset it and link it to
 * a child. What it can SEE is decided by the capability map, not by the fact
 * that this page created it.
 *
 * Conflating the two lists is how a guardian would end up holding staff
 * capabilities, so they are deliberately separate names in separate files.
 */
const MANAGEABLE_ROLES = [ROLES.ADMIN, ROLES.FACULTY, ROLES.GUARDIAN];

/** Fields safe to return for a staff member. */
function toStaffJSON(user, extra = {}) {
  return {
    id: String(user._id),
    name: user.name,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || null,
    phone: user.phone || '',
    role: user.role,
    title: user.title || '',
    subjects: user.subjects || [],
    status: user.status,
    // "Invited" until they have signed in at least once — this is what the
    // admin UI shows as a pending state.
    pendingInvite: Boolean(user.mustChangePassword && !user.lastLoginAt),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    ...extra,
  };
}

/**
 * List the staff of one organization, with each faculty member's classroom
 * count so an admin can see at a glance who is actually teaching.
 */
export async function listStaff({ org, role = null, search = '', page = 1, limit = 25 } = {}) {
  if (!org) throw ApiError.badRequest('An organization is required');

  const filter = { org, deletedAt: null, role: role ? role : { $in: MANAGEABLE_ROLES } };
  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { title: { $regex: safe, $options: 'i' } },
    ];
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [users, total] = await Promise.all([
    userRepository.model.find(filter).sort({ role: 1, createdAt: -1 }).skip(skip).limit(limit),
    userRepository.model.countDocuments(filter),
  ]);

  // Classroom counts for the faculty on this page, in one query.
  const facultyIds = users.filter((u) => u.role === ROLES.FACULTY).map((u) => u._id);
  const classCounts = new Map();
  if (facultyIds.length) {
    const rows = await Classroom.aggregate([
      { $match: { org, faculty: { $in: facultyIds }, archivedAt: null } },
      { $unwind: '$faculty' },
      { $match: { faculty: { $in: facultyIds } } },
      {
        $group: {
          _id: '$faculty',
          classrooms: { $sum: 1 },
          students: { $sum: { $size: { $ifNull: ['$students', []] } } },
        },
      },
    ]);
    for (const r of rows) {
      classCounts.set(String(r._id), { classrooms: r.classrooms, students: r.students });
    }
  }

  return {
    items: users.map((u) =>
      toStaffJSON(u, classCounts.get(String(u._id)) || { classrooms: 0, students: 0 })
    ),
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Create an admin or faculty account inside an organization.
 *
 * Staff log in by EMAIL (unlike students, who may have only a username), so an
 * email is required and must be globally unique. A generated password is
 * returned once so the inviting admin can hand it over; the account is flagged
 * to change it on first sign-in.
 */
export async function createStaff({ org, role, name, email, phone = '', title = '', subjects = [], password = null }) {
  if (!org) throw ApiError.badRequest('An organization is required');
  if (!MANAGEABLE_ROLES.includes(role)) {
    throw ApiError.badRequest(`Role must be one of: ${MANAGEABLE_ROLES.join(', ')}`);
  }

  const organization = await orgRepository.findById(org);
  if (!organization) throw ApiError.notFound('Organization not found');

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw ApiError.badRequest('An email address is required for staff');

  const clash = await userRepository.findByEmail(normalizedEmail);
  if (clash) throw ApiError.conflict('An account with this email already exists');

  const finalPassword = password || generatePassword();

  const user = new userRepository.model({
    role,
    name: String(name).trim(),
    email: normalizedEmail,
    phone: String(phone || '').trim(),
    title: String(title || '').trim(),
    subjects: Array.isArray(subjects) ? subjects.filter(Boolean).map(String) : [],
    org,
    mustChangePassword: true,
  });
  await user.setPassword(finalPassword);
  await user.save();

  await Organization.recountMembers(org);

  /**
   * Email the credentials WHEN THAT IS POSSIBLE, and always return them too.
   *
   * There was no mail infrastructure at all, so a temporary password reached a
   * new teacher only by being read off a screen. Now it can be emailed — but
   * the password is still returned to the caller, and the admin UI still shows
   * it once with a printable slip, because:
   *
   *   • mail is off by default (MAIL_TRANSPORT=none), and the product has to
   *     keep working exactly as before in that case;
   *   • school mail is unreliable enough that an administrator standing next
   *     to the new teacher should not have to wait on a mail queue;
   *   • `sendMail` never throws, so a mail outage cannot fail the account
   *     creation that has already succeeded.
   *
   * `emailed` is reported so the UI can say which happened rather than guess.
   */
  let emailed = false;
  if (mailEnabled()) {
    const cfg = mailConfig();
    const message = staffWelcomeMessage({
      name: user.name,
      email: user.email,
      tempPassword: finalPassword,
      signInUrl: cfg.appUrl ? `${cfg.appUrl}/login` : 'your school portal',
    });
    const result = await sendMail({ to: user.email, ...message });
    emailed = result.sent;
  }

  return { staff: toStaffJSON(user), password: finalPassword, emailed };
}

/** Fetch one staff member, scoped to the organization. */
export async function getStaff({ org, id }) {
  const user = await userRepository.model.findOne({
    _id: id,
    org,
    deletedAt: null,
    role: { $in: MANAGEABLE_ROLES },
  });
  if (!user) throw ApiError.notFound('Staff member not found');

  const classrooms = await Classroom.find({
    org,
    faculty: user._id,
    archivedAt: null,
  }).select('name grade section subject students');

  return toStaffJSON(user, {
    classrooms: classrooms.length,
    students: classrooms.reduce((n, c) => n + (c.students?.length || 0), 0),
    classroomList: classrooms.map((c) => ({
      id: String(c._id),
      name: c.name,
      grade: c.grade,
      section: c.section,
      subject: c.subject,
      studentCount: c.students?.length || 0,
    })),
  });
}

/** Update a staff member's profile, or change their role between admin/faculty. */
export async function updateStaff({ org, id, patch = {} }) {
  const user = await userRepository.model.findOne({
    _id: id,
    org,
    deletedAt: null,
    role: { $in: MANAGEABLE_ROLES },
  });
  if (!user) throw ApiError.notFound('Staff member not found');

  if (patch.email !== undefined) {
    const next = String(patch.email || '').trim().toLowerCase();
    if (next && next !== user.email) {
      const clash = await userRepository.findByEmail(next);
      if (clash && String(clash._id) !== String(user._id)) {
        throw ApiError.conflict('An account with this email already exists');
      }
      user.email = next;
    }
  }

  if (patch.role !== undefined && patch.role !== user.role) {
    if (!MANAGEABLE_ROLES.includes(patch.role)) {
      throw ApiError.badRequest('Staff role must be admin or faculty');
    }
    // Demoting the last remaining admin would lock the school out of its own
    // console, so refuse it.
    if (user.role === ROLES.ADMIN && patch.role !== ROLES.ADMIN) {
      const admins = await userRepository.model.countDocuments({
        org,
        role: ROLES.ADMIN,
        deletedAt: null,
        status: 'active',
      });
      if (admins <= 1) {
        throw ApiError.badRequest(
          'This is the only administrator for the organization. Add another administrator before changing this one.'
        );
      }
    }
    // Someone stepping back from admin to faculty keeps their classes; going
    // the other way, class assignments are harmless to leave in place.
    user.role = patch.role;
  }

  if (patch.name !== undefined) user.name = String(patch.name).trim();
  if (patch.phone !== undefined) user.phone = String(patch.phone).trim();
  if (patch.title !== undefined) user.title = String(patch.title).trim();
  if (patch.subjects !== undefined) {
    user.subjects = Array.isArray(patch.subjects)
      ? patch.subjects.filter(Boolean).map(String)
      : [];
  }

  await user.save();
  await Organization.recountMembers(org);
  return toStaffJSON(user);
}

/** Suspend or reactivate a staff account. */
export async function setStaffSuspension({ org, id, suspend = true }) {
  const user = await userRepository.model.findOne({
    _id: id,
    org,
    deletedAt: null,
    role: { $in: MANAGEABLE_ROLES },
  });
  if (!user) throw ApiError.notFound('Staff member not found');

  if (suspend && user.role === ROLES.ADMIN) {
    const admins = await userRepository.model.countDocuments({
      org,
      role: ROLES.ADMIN,
      deletedAt: null,
      status: 'active',
    });
    if (admins <= 1) {
      throw ApiError.badRequest(
        'This is the only active administrator. Add another before suspending this account.'
      );
    }
  }

  user.status = suspend ? 'suspended' : 'active';
  await user.save();
  // Suspension must sign them out of every device immediately.
  if (suspend) await userRepository.revokeAllSessions(user._id);

  return toStaffJSON(user);
}

/** Reset a staff password, returning the new one once. */
export async function resetStaffPassword({ org, id, password = null }) {
  const user = await userRepository.model.findOne({
    _id: id,
    org,
    deletedAt: null,
    role: { $in: MANAGEABLE_ROLES },
  });
  if (!user) throw ApiError.notFound('Staff member not found');

  const finalPassword = password || generatePassword();
  await user.setPassword(finalPassword);
  user.mustChangePassword = true;
  await user.save();
  await userRepository.revokeAllSessions(user._id);

  return { staff: toStaffJSON(user), password: finalPassword };
}

/**
 * Soft-delete a staff member and unassign them from every classroom, so a
 * class is never left pointing at a removed teacher.
 */
export async function deleteStaff({ org, id }) {
  const user = await userRepository.model.findOne({
    _id: id,
    org,
    deletedAt: null,
    role: { $in: MANAGEABLE_ROLES },
  });
  if (!user) throw ApiError.notFound('Staff member not found');

  if (user.role === ROLES.ADMIN) {
    const admins = await userRepository.model.countDocuments({
      org,
      role: ROLES.ADMIN,
      deletedAt: null,
    });
    if (admins <= 1) {
      throw ApiError.badRequest(
        'This is the only administrator for the organization. Add another administrator first.'
      );
    }
  }

  await Classroom.updateMany({ org, faculty: user._id }, { $pull: { faculty: user._id } });

  const freed = { email: user.email || '' };
  user.deletedAt = new Date();
  user.status = 'suspended';
  user.email = undefined;
  user.sessions = [];
  user.refreshTokenHash = null;
  await user.save();

  // If the primary contact was removed, promote another admin into the slot.
  const organization = await orgRepository.findById(org);
  if (organization && String(organization.adminUser) === String(user._id)) {
    const next = await userRepository.model
      .findOne({ org, role: ROLES.ADMIN, deletedAt: null })
      .sort({ createdAt: 1 });
    organization.adminUser = next ? next._id : undefined;
    await organization.save();
  }

  await Organization.recountMembers(org);
  return { id: String(user._id), softDeleted: true, freed };
}

export default {
  listStaff,
  createStaff,
  getStaff,
  updateStaff,
  setStaffSuspension,
  resetStaffPassword,
  deleteStaff,
};
