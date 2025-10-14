// Yêu cầu: đã có apiSlice gốc (createApi) export { apiSlice }.
// Đảm bảo apiSlice đã cấu hình baseUrl và có tagTypes: ['Sponsors', 'Sponsor'] (hoặc thêm nếu chưa có).
import { apiSlice } from "./apiSlice";

export const sponsorsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSponsors: builder.query({
      // args: { page=1, limit=20, search, tier, featured, sort }
      query: (params) => ({ url: "/admin/sponsors", params }),
      providesTags: (result) => {
        const base = [{ type: "Sponsors", id: "LIST" }];
        if (!result?.items?.length) return base;
        return [...base, ...result.items.map((x) => ({ type: "Sponsor", id: x._id }))];
      },
    }),

    getSponsor: builder.query({
      query: (id) => `/admin/sponsors/${id}`,
      providesTags: (_, __, id) => [{ type: "Sponsor", id }],
    }),

    createSponsor: builder.mutation({
      query: (body) => ({ url: "/admin/sponsors", method: "POST", body }),
      invalidatesTags: [{ type: "Sponsors", id: "LIST" }],
    }),

    updateSponsor: builder.mutation({
      query: ({ id, ...patch }) => ({ url: `/admin/sponsors/${id}`, method: "PUT", body: patch }),
      invalidatesTags: (_, __, arg) => [
        { type: "Sponsor", id: arg.id },
        { type: "Sponsors", id: "LIST" },
      ],
    }),

    deleteSponsor: builder.mutation({
      query: (id) => ({ url: `/admin/sponsors/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Sponsors", id: "LIST" }],
    }),

    reorderSponsors: builder.mutation({
      // body: { orders: [{ id, weight }, ...] }
      query: (orders) => ({ url: "/admin/sponsors/reorder", method: "POST", body: { orders } }),
      invalidatesTags: [{ type: "Sponsors", id: "LIST" }],
    }),
  }),
});

export const {
  useGetSponsorsQuery,
  useGetSponsorQuery,
  useCreateSponsorMutation,
  useUpdateSponsorMutation,
  useDeleteSponsorMutation,
  useReorderSponsorsMutation,
} = sponsorsApiSlice;
