import { baseApi, unwrap } from '../../app/api/baseApi'

export const shopApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getShopItems: builder.query({
      query: () => '/shop/items',
      transformResponse: unwrap,
      providesTags: ['Shop'],
    }),
    // Backend: POST /shop/purchase { itemKey }.
    purchaseItem: builder.mutation({
      query: (itemKey) => ({
        url: '/shop/purchase',
        method: 'POST',
        body: { itemKey },
      }),
      transformResponse: unwrap,
      invalidatesTags: ['Shop', 'Dashboard', 'Avatar'],
    }),
  }),
  overrideExisting: false,
})

export const { useGetShopItemsQuery, usePurchaseItemMutation } = shopApi
