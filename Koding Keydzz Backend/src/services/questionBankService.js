import { Question } from '../models/Question.js';
import { Course } from '../models/Course.js';
import { ApiError } from '../utils/ApiError.js';
import { blueprintFor, sectionTypes } from '../config/finalTest.js';

/**
 * THE QUESTION BANK, for the superadmin who authors it.
 *
 * Questions are written once per course and drawn into final tests. The one
 * thing this service adds beyond CRUD is COVERAGE: telling the author whether
 * the bank can actually produce a test, and where it is short.
 *
 * That check matters because the failure it prevents is invisible until the
 * worst possible moment — a pupil who has finished a whole course pressing
 * "Start test" and being told the bank is too small.
 */

/** Resolve a course by slug, or 404. */
async function requireCourse(slug) {
  const course = await Course.findOne({ slug }).lean();
  if (!course) throw ApiError.notFound(`No course with slug "${slug}"`);
  return course;
}

export async function listQuestions({
  courseSlug,
  type,
  difficulty,
  search = '',
  active,
  page = 1,
  limit = 25,
} = {}) {
  const filter = {};
  if (courseSlug) filter.courseSlug = courseSlug;
  if (type) filter.type = type;
  if (difficulty) filter.difficulty = difficulty;
  if (active === 'true') filter.active = true;
  if (active === 'false') filter.active = false;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ prompt: rx }, { context: rx }, { tags: rx }];
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [docs, total] = await Promise.all([
    Question.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Question.countDocuments(filter),
  ]);

  return {
    items: docs.map(serialise),
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * The author DOES see the mark scheme — they wrote it. Only the student-facing
 * serializer in finalTestService strips it.
 */
function serialise(q) {
  return {
    id: String(q._id),
    _id: String(q._id),
    courseSlug: q.courseSlug,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    context: q.context || '',
    options: q.options || [],
    answerIndex: q.answerIndex ?? null,
    acceptedAnswers: q.acceptedAnswers || [],
    language: q.language || 'python',
    starterCode: q.starterCode || '',
    testCases: q.testCases || [],
    expectedOutcome: q.expectedOutcome || '',
    tags: q.tags || [],
    active: q.active !== false,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

export async function createQuestion(body, actorId) {
  const course = await requireCourse(body.courseSlug);
  const doc = await Question.create({
    ...body,
    course: course._id,
    courseSlug: course.slug,
    // A coding answer is executed as the course's language unless the author
    // says otherwise.
    language: body.language || course.language,
    createdBy: actorId || null,
  });
  return serialise(doc.toObject());
}

export async function updateQuestion(id, body) {
  const doc = await Question.findById(id);
  if (!doc) throw ApiError.notFound('Question not found');

  if (body.courseSlug && body.courseSlug !== doc.courseSlug) {
    const course = await requireCourse(body.courseSlug);
    doc.course = course._id;
    doc.courseSlug = course.slug;
  }
  for (const [key, value] of Object.entries(body)) {
    if (key === 'courseSlug') continue;
    doc[key] = value;
  }
  // The model's pre-validate hook re-checks the mark scheme, so an edit cannot
  // leave a question unmarkable.
  await doc.save();
  return serialise(doc.toObject());
}

/**
 * Retire a question rather than delete it.
 *
 * Past attempts store the question ids they drew. Removing the document would
 * orphan those records, so a pupil could no longer see the paper they sat.
 */
export async function retireQuestion(id) {
  const doc = await Question.findByIdAndUpdate(id, { active: false }, { new: true });
  if (!doc) throw ApiError.notFound('Question not found');
  return serialise(doc.toObject());
}

export async function deleteQuestion(id) {
  const used = await (await import('../models/TestAttempt.js')).TestAttempt.countDocuments({
    'paper.question': id,
  });
  if (used > 0) {
    // Refused with a reason and an alternative, rather than a bare 409.
    throw ApiError.badRequest(
      `This question has been used in ${used} test attempt(s), so deleting it would ` +
        'break those records. Retire it instead — retired questions are never drawn again.'
    );
  }
  const doc = await Question.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound('Question not found');
  return { id: String(doc._id) };
}

/**
 * Can this course actually produce a final test, and where is the bank short?
 *
 * Reported per blueprint section with the shortfall spelled out, because
 * "add more questions" is not an instruction — "the Coding section needs 3 and
 * has 1" is.
 */
export async function bankCoverage(courseSlug) {
  const course = await requireCourse(courseSlug);
  const sections = blueprintFor(course.kind);

  const rows = [];
  for (const section of sections) {
    const filter = {
      courseSlug: course.slug,
      type: { $in: sectionTypes(section) },
      active: true,
    };
    if (section.difficulty) filter.difficulty = section.difficulty;
    const available = await Question.countDocuments(filter);

    rows.push({
      section: section.id,
      label: section.label,
      types: sectionTypes(section),
      difficulty: section.difficulty || null,
      needed: section.count,
      available,
      shortfall: Math.max(0, section.count - available),
      ready: available >= section.count,
      pointsEach: section.pointsEach,
      sectionPoints: section.count * section.pointsEach,
    });
  }

  const shortfall = rows.reduce((n, r) => n + r.shortfall, 0);
  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    kind: course.kind,
    sections: rows,
    ready: shortfall === 0,
    shortfall,
    // The number to add before any pupil can sit this test.
    summary:
      shortfall === 0
        ? `Ready — a full ${rows.reduce((n, r) => n + r.sectionPoints, 0)}-point test can be drawn.`
        : `${shortfall} more question(s) needed before this test can be sat.`,
  };
}

export default {
  listQuestions,
  createQuestion,
  updateQuestion,
  retireQuestion,
  deleteQuestion,
  bankCoverage,
};
