/**
 * Capability-based permissions.
 *
 * WHY THIS EXISTS
 * ---------------
 * Authorization used to be raw role strings scattered across eight route
 * files — `authorize('admin')`, `authorize('admin', 'superadmin')`, and so on.
 * That works for three roles, but it means introducing a fourth (faculty)
 * requires finding and editing every one of those call sites, and getting one
 * wrong is a silent privilege bug rather than a test failure.
 *
 * Routes now declare the CAPABILITY they need, and this file is the single
 * place that decides which roles hold it. Adding a role is one entry here.
 *
 * WHAT THIS FILE IS, PRECISELY
 * ----------------------------
 * It has two consumers, and knowing both is the difference between reading it
 * correctly and thinking half of it is dead:
 *
 *   1. SERVER GATES. `requireCapability(...)` on org-scoped routes and the
 *      learner surface. This is the enforcement that matters.
 *   2. THE CLIENT'S NAVIGATION CONTRACT. `capabilitiesForRole` is sent to the
 *      browser on sign-in and the admin portal hides any nav item and any
 *      write control whose capability the user does not hold. So an entry with
 *      no `requireCapability` call site is not necessarily unused — several
 *      exist to drive the sidebar.
 *
 * The one deliberate exception is the SUPERADMIN CONSOLE. Its whole router is
 * gated `authorize('superadmin')` in one place rather than capability by
 * capability across forty routes, because the console is the platform owner's
 * in its entirety and a single coarse gate cannot be forgotten on a new route.
 * The `org:*` and `platform:*` entries below therefore drive navigation rather
 * than enforcement — which is why they are marked.
 *
 * THE TENANCY MODEL
 * -----------------
 *   superadmin  — platform owner. Tenant-less (org = null). Manages
 *                 organizations and the shared curriculum. Sees everything.
 *   admin       — organization administrator. MANY per organization. Manages
 *                 that org's faculty, students and classrooms.
 *   faculty     — teacher within an organization. Sees and reports on the
 *                 students in the classrooms they are assigned to. Cannot
 *                 manage the organization itself or other staff.
 *   student     — the learner.
 *
 * A capability is a plain string, namespaced `resource:action`.
 */

export const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
  /**
   * A parent or carer. Reads ONE OR MORE named children's progress and nothing
   * else — no class, no other pupil, no curriculum, no staff. Linked to a child
   * by an administrator, never by themselves.
   */
  GUARDIAN: 'guardian',
});

/** Roles that belong to an organization (everything except the superadmin). */
export const ORG_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.FACULTY,
  ROLES.STUDENT,
  ROLES.GUARDIAN,
]);

/** Roles that are staff (can see other people's data, subject to scoping). */
export const STAFF_ROLES = Object.freeze([ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY]);

/**
 * capability -> roles that hold it.
 *
 * Read this as the authorization spec for the whole product.
 */
export const CAPABILITIES = Object.freeze({
  /* ---- Platform (superadmin only).
   * NAVIGATION ONLY — enforcement for these is the router-level
   * `authorize('superadmin')` on superadminRoutes, not a per-route capability.
   * They are here because the admin portal's sidebar is capability-driven and
   * needs to know which console entries to show. ---- */
  'org:create': [ROLES.SUPERADMIN],
  'org:update': [ROLES.SUPERADMIN],
  'org:delete': [ROLES.SUPERADMIN],
  'org:list_all': [ROLES.SUPERADMIN],
  'platform:analytics': [ROLES.SUPERADMIN],
  'platform:audit': [ROLES.SUPERADMIN],
  'platform:announce': [ROLES.SUPERADMIN],

  /* ---- Curriculum. Global content shared by every tenant, so only the
   * platform owner may WRITE it — one school must not be able to rename a
   * world or delete a quiz for all the others. Staff may read it. ---- */
  'content:read': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],
  'content:write': [ROLES.SUPERADMIN],

  /* ---- Organization staff management (admins only) ---- */
  'staff:read': [ROLES.SUPERADMIN, ROLES.ADMIN],
  'staff:write': [ROLES.SUPERADMIN, ROLES.ADMIN],

  /* ---- Students ----
   * Faculty may READ students, but only those in their own classrooms —
   * enforced separately by the classroom scope, since a capability alone
   * cannot express "mine". */
  'student:read': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],
  'student:write': [ROLES.SUPERADMIN, ROLES.ADMIN],
  'student:reset_password': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],
  'student:import': [ROLES.SUPERADMIN, ROLES.ADMIN],
  'student:export': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],

  /* ---- Classrooms ---- */
  'classroom:read': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],
  'classroom:write': [ROLES.SUPERADMIN, ROLES.ADMIN],
  // Faculty may change the ROSTER of a class they teach, but not create or
  // delete classes.
  'classroom:manage_roster': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],

  /**
   * Marking work the machine could not mark.
   *
   * Faculty included: they are the ones who know the pupil and the work. It is
   * narrow by construction — only answers already flagged `needsReview` can be
   * touched, marks are capped at the question's allowance, and every mark is
   * audited. See services/markingService.js.
   */
  'final_test:mark': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],

  /* ---- Reporting ---- */
  'report:org': [ROLES.SUPERADMIN, ROLES.ADMIN],
  'report:class': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],

  /**
   * ASSIGNMENTS — setting work with a deadline.
   *
   * Faculty hold the write capability, and that is the whole point: a teacher
   * setting homework for their own class is the thing this exists for. The
   * classroom scope confines them to classes they teach, exactly as it does
   * for rosters and reports — so `assignment:write` means "may set work", not
   * "may set work for anyone".
   */
  'assignment:read': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY, ROLES.STUDENT],
  'assignment:write': [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY],

  /* ---- Announcements within one organization ---- */
  'announce:org': [ROLES.ADMIN],
  'announce:class': [ROLES.ADMIN, ROLES.FACULTY],

  /* ---- Organization audit trail ---- */
  'audit:org': [ROLES.ADMIN],

  /**
   * GUARDIAN — reading a linked child's progress.
   *
   * One capability, one verb, and nothing else on the whole list. A guardian
   * holds no `student:read` (that would be the whole school), no
   * `classroom:read` (that would be other people's children) and no write
   * capability of any kind. The set of children is resolved from their own
   * `guardianOf` links, so there is no id for them to tamper with.
   */
  'child:read': [ROLES.GUARDIAN],

  /* ---- Learner surfaces ---- */
  'learn:play': [ROLES.STUDENT],

  /**
   * The game catalogue and its leaderboards.
   *
   * A faithful migration of `authorize('student', 'admin', 'superadmin')`:
   * the same three roles, no more. Faculty are absent because they were absent
   * before, and widening access is a product decision rather than part of
   * tidying up how it is expressed. (A teacher arguably should be able to see
   * what their class plays — worth revisiting deliberately.)
   */
  'game:catalog': [ROLES.STUDENT, ROLES.ADMIN, ROLES.SUPERADMIN],
});

/** Does this role hold this capability? */
export function roleHasCapability(role, capability) {
  const allowed = CAPABILITIES[capability];
  if (!allowed) {
    // Fail CLOSED on an unknown capability — a typo must deny, never allow.
    return false;
  }
  return allowed.includes(role);
}

/** Every capability a role holds (used to drive the client's navigation). */
export function capabilitiesForRole(role) {
  return Object.entries(CAPABILITIES)
    .filter(([, roles]) => roles.includes(role))
    .map(([cap]) => cap);
}

/**
 * Is this role restricted to the classrooms it is assigned to?
 *
 * Faculty see a SUBSET of their organization; admins see all of it. This is
 * the flag the student/report services use to decide whether to narrow a
 * query to the caller's classroom roster.
 */
export function isClassroomScoped(role) {
  return role === ROLES.FACULTY;
}

export default {
  ROLES,
  ORG_ROLES,
  STAFF_ROLES,
  CAPABILITIES,
  roleHasCapability,
  capabilitiesForRole,
  isClassroomScoped,
};
