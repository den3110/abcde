// Yêu cầu: apiSlice đã cấu hình baseUrl và có tagTypes: ['Sponsors', 'Sponsor']
import { apiSlice } from "./apiSlice";

export const sponsorsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // args có thể gồm: page, limit, search, tier, featured, sort, tournamentId|tid|tids, hasTournament
    getSponsors: builder.query({
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
      // body có thể kèm tournamentIds: string[] (array of ObjectId)
      query: (body) => ({ url: "/admin/sponsors", method: "POST", body }),
      invalidatesTags: [{ type: "Sponsors", id: "LIST" }],
    }),

    updateSponsor: builder.mutation({
      // { id, ...patch } – patch có thể kèm tournamentIds hoặc tournaments (CSV/array)
      query: ({ id, ...patch }) => ({
        url: `/admin/sponsors/${id}`,
        method: "PUT",
        body: patch,
      }),
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
      // orders: [{ id, weight }]
      query: (orders) => ({
        url: "/admin/sponsors/reorder",
        method: "POST",
        body: { orders },
      }),
      invalidatesTags: [{ type: "Sponsors", id: "LIST" }],
    }),

    // (tuỳ chọn) public list cho landing/overlay: ?tournamentId|tids=&includeGlobal=1
    publicSponsors: builder.query({
      query: (params) => ({ url: "/public/sponsors", params }),
      // public không cần tags
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
  usePublicSponsorsQuery,
} = sponsorsApiSlice;
