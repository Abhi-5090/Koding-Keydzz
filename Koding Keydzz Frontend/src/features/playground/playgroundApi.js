import { baseApi, unwrap } from '../../app/api/baseApi'

export const playgroundApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Execute code in the backend sandbox. Returns { stdout, stderr, output, exitCode, mocked }.
    runCode: builder.mutation({
      query: ({ language, code, stdin = '' }) => ({
        url: '/playground/run',
        method: 'POST',
        body: { language, code, stdin },
      }),
      transformResponse: unwrap,
    }),
  }),
  overrideExisting: false,
})

export const { useRunCodeMutation } = playgroundApi
