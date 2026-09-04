import { baseApi, unwrap } from '../../app/api/baseApi'

/**
 * CERTIFICATES.
 *
 * The whole issuing side of this was already built and tested on the server —
 * idempotent issue on a pass, snapshotted facts so a later rename cannot
 * rewrite an award, org/course template resolution, revocation, and a public
 * verification endpoint that leaks nothing. None of it had a screen, so a child
 * who passed a course earned a certificate they could not see.
 *
 * `verifyCertificate` is deliberately separate from `getCertificate`:
 *   • getCertificate  — MINE. Authenticated, full detail, used to render and print.
 *   • verifyCertificate — ANYONE'S. Public, and returns only enough to confirm
 *     the achievement is real. A parent checking a code must not be handed the
 *     child's account details, so the server answers with the achievement and
 *     nothing else.
 */
export const certificatesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyCertificates: builder.query({
      query: () => '/certificates',
      transformResponse: unwrap,
      providesTags: ['Certificates'],
    }),

    getCertificate: builder.query({
      query: (code) => `/certificates/${code}`,
      transformResponse: unwrap,
      providesTags: ['Certificates'],
    }),

    /**
     * Public verification. No auth header is needed and none is required —
     * this is the endpoint behind a code printed on paper.
     */
    verifyCertificate: builder.query({
      query: (code) => `/certificates/verify/${encodeURIComponent(code)}`,
      transformResponse: unwrap,
    }),
  }),
})

export const {
  useGetMyCertificatesQuery,
  useGetCertificateQuery,
  useVerifyCertificateQuery,
} = certificatesApi
