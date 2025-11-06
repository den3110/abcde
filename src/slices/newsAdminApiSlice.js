// src/slices/newsAdminApiSlice.js
import { apiSlice } from "./apiSlice";

export const newsAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/admin/news/settings
    getNewsSettings: builder.query({
      query: () => ({
        url: "/admin/news/settings",
      }),
      providesTags: ["NewsSettings"],
    }),

    // PUT /api/admin/news/settings
    updateNewsSettings: builder.mutation({
      query: (body) => ({
        url: "/admin/news/settings",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["NewsSettings"],
    }),

    // GET /api/admin/news/candidates
    getNewsCandidates: builder.query({
      query: () => ({
        url: "/admin/news/candidates",
      }),
      providesTags: ["NewsCandidates"],
    }),
    // 🆕 Chạy sync thủ công
    runNewsSync: builder.mutation({
      query: () => ({
        url: "/admin/news/run",
        method: "POST",
      }),
      invalidatesTags: ["NewsCandidates"],
    }),
  }),
});

export const {
  useGetNewsSettingsQuery,
  useUpdateNewsSettingsMutation,
  useGetNewsCandidatesQuery,
  useRunNewsSyncMutation, // 🆕
} = newsAdminApiSlice;
