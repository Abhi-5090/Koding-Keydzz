import { isFulfilled } from '@reduxjs/toolkit';
import { toast } from '../../components/ui/toast/ToastProvider';

/**
 * ACKNOWLEDGE EVERY SUCCESSFUL WRITE.
 *
 * WHY A MAP RATHER THAN A TOAST AT EACH CALL SITE
 * -----------------------------------------------
 * There are sixty-odd mutations in this portal. Adding a success toast to each
 * one by hand means sixty chances to forget, and the ones that get forgotten
 * are the rarely-used destructive ones — exactly where a person most needs to
 * know it worked. One declarative map covers all of them, and a mutation added
 * later without an entry falls back to a generic confirmation rather than
 * silently doing nothing.
 *
 * WHY ONLY MUTATIONS
 * ------------------
 * A successful READ needs no announcement: the data appearing on screen IS the
 * acknowledgement. Toasting reads would produce a stream of noise that trains
 * people to ignore the corner of the screen where the failures appear.
 *
 * WHY SOME MUTATIONS ARE SILENT
 * -----------------------------
 * Where the screen already gives unmistakable feedback, a toast is redundant
 * and slightly insulting: signing in navigates you to a dashboard; a marked
 * answer replaces itself with a green confirmation in place. Listed explicitly
 * rather than left to whoever adds the next one.
 */

/**
 * endpointName -> the sentence to show, or a function of the response.
 *
 * Written in school language and in the past tense, because a confirmation is
 * a statement about what happened, not a label for a button.
 */
const MESSAGES = {
  /* ---- Pupils ---- */
  createStudent: (d) => `${d?.student?.name || 'Pupil'} added.`,
  updateStudent: 'Pupil details saved.',
  suspendStudent: (d) =>
    d?.status === 'suspended'
      ? 'Pupil suspended. They have been signed out of every device.'
      : 'Pupil reactivated.',
  deleteStudent: 'Pupil removed. Their record is kept for the audit trail.',
  resetStudentPassword: 'Password reset. The new one is shown once — hand it over now.',

  /* ---- Staff and guardians ---- */
  createStaff: (d) =>
    d?.emailed
      ? `${d?.staff?.name || 'Account'} created, and the sign-in details were emailed.`
      : `${d?.staff?.name || 'Account'} created. The password is shown once — print or hand over the slip now.`,
  updateStaff: 'Details saved.',
  suspendStaff: 'Access changed.',
  deleteStaff: 'Account removed.',
  resetStaffPassword:
    'Password reset. They will be asked to choose their own the next time they sign in.',

  /* ---- Classes ---- */
  createClassroom: (d) => `Class “${d?.name || ''}” created.`,
  updateClassroom: 'Class saved.',
  updateClassroomRoster: 'Class roster updated.',
  updateClassroomFaculty: 'Teachers for this class updated.',
  archiveClassroom: (d) =>
    d?.archivedAt ? 'Class archived. Its reports are still available.' : 'Class restored.',

  /* ---- Assignments ---- */
  createAssignment: 'Work set. The class will see it straight away.',
  updateAssignment: 'Assignment updated.',
  archiveAssignment: 'Assignment archived. It is hidden from the class but kept on record.',

  /* ---- Marking ---- */
  // Deliberately absent from SILENT: releasing a withheld mark changes a
  // pupil's score and can change a pass, so it is worth saying out loud even
  // though the card also confirms it in place.
  markTestAnswer: 'Marks awarded. The whole paper has been rescored.',

  /* ---- Announcements ---- */
  broadcastNotification: (d) =>
    `Announcement sent to ${d?.count ?? 'the'} ${d?.count === 1 ? 'person' : 'people'} in your school.`,
  broadcastPlatform: 'Platform announcement sent.',

  /* ---- Curriculum (superadmin) ---- */
  createWorld: 'World created.',
  updateWorld: 'World saved.',
  deleteWorld: 'World deleted.',
  createLesson: 'Lesson created.',
  updateLesson: 'Lesson saved.',
  deleteLesson: 'Lesson deleted.',
  createCourse: 'Course created.',
  updateCourse: 'Course saved.',
  deleteCourse: 'Course deleted.',
  createQuiz: 'Quiz created.',
  updateQuiz: 'Quiz saved.',
  deleteQuiz: 'Quiz deleted.',
  createChallenge: 'Challenge created.',
  updateChallenge: 'Challenge saved.',
  deleteChallenge: 'Challenge deleted.',
  createAchievement: 'Badge created.',
  updateAchievement: 'Badge saved.',
  deleteAchievement: 'Badge deleted.',
  createShopItem: 'Shop item created.',
  updateShopItem: 'Shop item saved.',
  deleteShopItem: 'Shop item deleted.',

  /* ---- Question bank ---- */
  createQuestion: 'Question added to the bank.',
  updateQuestion: 'Question saved.',
  retireQuestion:
    'Question retired. It stays on every paper that already used it, and will not be drawn again.',
  deleteQuestion: 'Question deleted.',

  /* ---- Organizations (superadmin) ---- */
  createOrg: (d) => `School “${d?.name || ''}” created.`,
  updateOrg: 'School saved.',
  deleteOrg: 'School removed.',
  updateOrgAdmin: 'Administrator updated.',
  createOrgStaff: 'Staff account created for this school.',
  deleteOrgStaff: 'Staff account removed.',
  createOrgStudent: 'Pupil added to this school.',
  assignUserOrganization: 'Account assigned to a school.',
  updateSuperStudent: 'Pupil saved.',
  suspendSuperStudent: 'Pupil access changed.',
  deleteSuperStudent: 'Pupil removed.',
  resetSuperStudentPassword: 'Password reset. The new one is shown once.',
};

/**
 * Mutations whose own screen already says it unmistakably.
 *
 * `login` navigates to a dashboard; `logout` navigates to the sign-in form;
 * `changePassword` renders its own confirmation and then redirects. A toast on
 * top of a full page change is noise.
 */
const SILENT = new Set(['login', 'logout', 'changePassword']);

export const toastOnSuccess = () => (next) => (action) => {
  if (!isFulfilled(action)) return next(action);
  if (action.meta?.arg?.type !== 'mutation') return next(action);

  const endpoint = action.meta.arg.endpointName;
  if (SILENT.has(endpoint)) return next(action);

  const entry = MESSAGES[endpoint];

  /**
   * An unmapped mutation still gets acknowledged.
   *
   * "Saved." is vague, but it is honest and it is very much better than
   * silence — which is indistinguishable from the request having failed. A new
   * endpoint therefore degrades to a weak confirmation rather than to nothing.
   */
  let message = 'Saved.';
  if (typeof entry === 'function') {
    try {
      message = entry(action.payload) || message;
    } catch {
      /* a shape we did not expect — fall back rather than throw in middleware */
    }
  } else if (typeof entry === 'string') {
    message = entry;
  }

  toast().success(message);
  return next(action);
};

export default toastOnSuccess;
