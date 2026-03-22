import { apiSlice } from "./apiSlice";

export const adminCacheApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCacheSummary: builder.query({
      query: () => ({
        url: "/admin/cache/summary",
        method: "GET",
      }),
      providesTags: ["AdminCache"],
    }),
    clearCacheGroup: builder.mutation({
      query: (cacheId) => ({
        url: `/admin/cache/${encodeURIComponent(cacheId)}/clear`,
        method: "POST",
      }),
      invalidatesTags: ["AdminCache"],
    }),
    clearAllCaches: builder.mutation({
      query: () => ({
        url: "/admin/cache/clear-all",
        method: "POST",
      }),
      invalidatesTags: ["AdminCache"],
    }),
  }),
});

export const { useGetCacheSummaryQuery, useClearCacheGroupMutation, useClearAllCachesMutation } =
  adminCacheApiSlice;
