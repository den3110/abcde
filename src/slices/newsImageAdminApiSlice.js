// src/slices/newsImageAdminApiSlice.js
import { apiSlice } from "./apiSlice";

export const newsImageAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/admin/seo-news/image-stats
    getNewsImageStats: builder.query({
      query: ({ page = 1, limit = 30, imageFilter, origin, keyword, refreshHealth } = {}) => {
        const params = new URLSearchParams();
        params.set("page", page);
        params.set("limit", limit);
        if (imageFilter) params.set("imageFilter", imageFilter);
        if (origin) params.set("origin", origin);
        if (keyword) params.set("keyword", keyword);
        if (refreshHealth) params.set("refreshHealth", "true");
        return { url: `/admin/seo-news/image-stats?${params.toString()}` };
      },
      providesTags: ["NewsImageStats"],
    }),

    // POST /api/admin/seo-news/articles/create-ready  (backfill)
    backfillNewsImages: builder.mutation({
      query: (body) => ({
        url: "/admin/seo-news/articles/create-ready",
        method: "POST",
        body,
      }),
      invalidatesTags: ["NewsImageStats"],
    }),

    // POST /api/admin/seo-news/images/cleanup-source
    cleanupGatewayImages: builder.mutation({
      query: (body) => ({
        url: "/admin/seo-news/images/cleanup-source",
        method: "POST",
        body,
      }),
      invalidatesTags: ["NewsImageStats"],
    }),
    queueNewsImageRegenerationJob: builder.mutation({
      query: (body) => ({
        url: "/admin/seo-news/images/regeneration-jobs",
        method: "POST",
        body,
      }),
      invalidatesTags: ["NewsImageStats"],
    }),
    updateSeoNewsImageSettings: builder.mutation({
      query: (body) => ({
        url: "/admin/seo-news/settings",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["NewsImageStats"],
    }),
  }),
});

export const {
  useGetNewsImageStatsQuery,
  useBackfillNewsImagesMutation,
  useCleanupGatewayImagesMutation,
  useQueueNewsImageRegenerationJobMutation,
  useUpdateSeoNewsImageSettingsMutation,
} = newsImageAdminApiSlice;
