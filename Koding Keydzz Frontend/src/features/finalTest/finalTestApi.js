import { baseApi, unwrap } from '../../app/api/baseApi'

/**
 * THE FINAL TEST, for pupils.
 *
 * The exam that gates the course ladder: 200 marks, 150 to pass, three
 * attempts. Everything that decides a mark stays on the server — this slice
 * moves answers up and results down, and never sees a mark scheme.
 *
 * Two things here are deliberately NOT cached the way the rest of the app
 * caches reads:
 *
 *   • `startFinalTest` is a MUTATION even though it mostly reads a paper. The
 *     first call has a real side effect — it draws the questions and burns one
 *     of three attempts — so it must never be fired by a cache refetch, a
 *     remount, or a window refocus. A query here would eventually cost a pupil
 *     an attempt they did not ask to spend.
 *
 *   • `saveProgress` invalidates nothing. It fires on a timer while the pupil
 *     works, and any invalidation would refetch the paper mid-exam.
 */
export const finalTestApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * May I sit it, and if not, what is left to do?
     *
     * `{ allowed, reason, attemptsUsed, attemptsLeft, readiness, passed }`.
     * The `reason` is written for the pupil and names what remains, so the UI
     * shows it verbatim rather than inventing its own wording.
     */
    getFinalTestEligibility: builder.query({
      query: (slug) => `/final-test/${slug}/eligibility`,
      transformResponse: unwrap,
      providesTags: (res, err, slug) => [{ type: 'FinalTest', id: slug }],
    }),

    /** Start or resume. See the note above on why this is a mutation. */
    startFinalTest: builder.mutation({
      query: (slug) => ({ url: `/final-test/${slug}/start`, method: 'POST' }),
      transformResponse: unwrap,
      invalidatesTags: (res, err, slug) => [{ type: 'FinalTest', id: slug }],
    }),

    /** Save without submitting, so a lost tab is survivable. */
    saveProgress: builder.mutation({
      query: ({ attemptId, answers }) => ({
        url: `/final-test/attempts/${attemptId}`,
        method: 'PATCH',
        body: { answers },
      }),
      transformResponse: unwrap,
    }),

    /**
     * Submit and mark.
     *
     * Passing writes the course's `completedAt`, which is what the ladder
     * gates on — so this invalidates Courses and Dashboard as well, or the
     * pupil would pass and still see the next course locked.
     */
    submitFinalTest: builder.mutation({
      query: ({ attemptId, answers }) => ({
        url: `/final-test/attempts/${attemptId}/submit`,
        method: 'POST',
        body: { answers },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Courses', 'Dashboard', 'FinalTest'],
    }),
  }),
})

export const {
  useGetFinalTestEligibilityQuery,
  useStartFinalTestMutation,
  useSaveProgressMutation,
  useSubmitFinalTestMutation,
} = finalTestApi
