import { baseApi, unwrap } from '../../app/api/baseApi'

export const avatarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAvatarItems: builder.query({
      query: () => '/avatar/items',
      transformResponse: unwrap,
      providesTags: ['Avatar'],
    }),
    getMyAvatar: builder.query({
      query: () => '/avatar/me',
      transformResponse: unwrap,
      providesTags: ['Avatar'],
    }),
    // Equip a single owned item by its key. Backend: PUT /avatar/me { key }.
    equipAvatarItem: builder.mutation({
      query: (key) => ({
        url: '/avatar/me',
        method: 'PUT',
        body: { key },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Avatar'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetAvatarItemsQuery,
  useGetMyAvatarQuery,
  useEquipAvatarItemMutation,
} = avatarApi
