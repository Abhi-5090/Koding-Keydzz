import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Course } from '../models/Course.js';
import { userRepository } from '../repositories/userRepository.js';
import { ApiError } from '../utils/ApiError.js';
import {
  listCoursesForUser,
  courseReadiness,
  resolveCurrentCourse,
  startCourse as startCourseProgress,
} from '../services/courseService.js';

/**
 * The course ladder, from the signed-in pupil's point of view.
 *
 * The user document is re-read from the database rather than taken from
 * `req.user`: readiness counts `completedLessons` and `gameProgress`, and the
 * token-derived user is a lean projection that does not carry them. Using it
 * would report every pupil as having done nothing.
 */
async function loadFullUser(req) {
  const user = await userRepository.findById(req.user._id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export const listCourses = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);
  const data = await listCoursesForUser(user);
  return sendSuccess(res, data, 'Courses');
});

export const getCourse = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);

  // resolveCurrentCourse enforces the lock: a pupil asking for a course they
  // have not unlocked gets a 403 with the reason, not its content.
  const summary = await resolveCurrentCourse(user, req.params.slug);

  // The service returns the ladder projection; readiness needs the document.
  const course = await Course.findById(summary.id).lean();
  if (!course) throw ApiError.notFound('Course not found');

  const readiness = summary.passed
    ? null
    : await courseReadiness(user, course);

  return sendSuccess(res, { ...summary, readiness }, course.title);
});

export const startCourse = asyncHandler(async (req, res) => {
  const user = await loadFullUser(req);
  const summary = await resolveCurrentCourse(user, req.params.slug);
  const progress = await startCourseProgress(user, summary.id, summary.slug);

  return sendSuccess(
    res,
    {
      slug: summary.slug,
      startedAt: progress.startedAt,
      // Echoed so the client does not need a second request to render the
      // "you are on course 2 of 4" header after starting.
      order: summary.order,
      title: summary.title,
    },
    `Started ${summary.title}`
  );
});

export default { listCourses, getCourse, startCourse };
