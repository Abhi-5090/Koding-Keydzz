import { baseApi, unwrap } from '../../app/api/baseApi'

/**
 * THE COURSE LADDER: Python → C → HTML/CSS → AI.
 *
 * A pupil works one language at a time; each course unlocks when the previous
 * one's final test is passed. The server derives every part of that — lock
 * state, readiness per strand, and the reason a course is locked — so the
 * client never recomputes it.
 *
 * That is deliberate. A second implementation here would eventually disagree
 * with the one that actually gates the content, and then the UI would promise
 * a course the API refuses to serve.
 */
export const coursesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * The whole ladder with this pupil's standing in each course.
     *
     * `{ items: [...], currentSlug, passMark, total, maxAttempts }` where each
     * item carries `status`, `unlocked`, `tint`, `lockedReason` and — for an
     * open, unfinished course — a `readiness` breakdown per strand.
     */
    getCourses: builder.query({
      query: () => '/courses',
      transformResponse: unwrap,
      providesTags: ['Courses'],
    }),

    getCourse: builder.query({
      query: (slug) => `/courses/${slug}`,
      transformResponse: unwrap,
      providesTags: (res, err, slug) => [{ type: 'Courses', id: slug }],
    }),

    /**
     * Mark a course started. Idempotent, so it is safe to fire whenever a
     * pupil opens its content — "in progress" then reflects what they did
     * rather than something an admin had to remember to set.
     *
     * Invalidates Worlds and Dashboard as well as Courses: starting a course
     * changes which worlds the API will serve, and the dashboard shows the
     * current track.
     */
    startCourse: builder.mutation({
      query: (slug) => ({ url: `/courses/${slug}/start`, method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses', 'Worlds', 'Dashboard'],
    }),
  }),
})

export const { useGetCoursesQuery, useGetCourseQuery, useStartCourseMutation } =
  coursesApi
