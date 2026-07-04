import { baseApi, unwrap } from '../../app/api/baseApi'

export const quizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // List available quizzes so the client can pick one to play.
    getQuizzes: builder.query({
      query: () => '/quizzes',
      transformResponse: unwrap,
      providesTags: ['Quiz'],
    }),
    getQuiz: builder.query({
      query: (id) => `/quizzes/${id}`,
      transformResponse: unwrap,
      providesTags: ['Quiz'],
    }),
    submitQuiz: builder.mutation({
      query: ({ id, answers }) => ({
        url: `/quizzes/${id}/submit`,
        method: 'POST',
        body: { answers },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Quiz', 'Dashboard'],
    }),
  }),
  overrideExisting: false,
})

export const { useGetQuizzesQuery, useGetQuizQuery, useSubmitQuizMutation } = quizApi
