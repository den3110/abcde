// src/slices/feedAdminApiSlice.js — admin moderation Bảng tin
import { apiSlice } from "./apiSlice";

export const feedAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    adminListFeedPosts: builder.query({
      query: ({ cursor, filter = "all", limit = 20 } = {}) => {
        const p = new URLSearchParams();
        if (cursor) p.set("cursor", String(cursor));
        if (filter) p.set("filter", filter);
        if (limit) p.set("limit", String(limit));
        return { url: `/admin/feed/posts?${p.toString()}`, method: "GET" };
      },
      providesTags: [{ type: "AdminFeed", id: "LIST" }],
    }),
    adminPatchFeedPost: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/feed/posts/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "AdminFeed", id: "LIST" }],
    }),
    adminDeleteFeedPost: builder.mutation({
      query: (id) => ({ url: `/admin/feed/posts/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "AdminFeed", id: "LIST" }],
    }),
    adminListFeedReports: builder.query({
      query: ({ cursor, status = "pending", limit = 20 } = {}) => {
        const p = new URLSearchParams();
        if (cursor) p.set("cursor", String(cursor));
        if (status) p.set("status", status);
        if (limit) p.set("limit", String(limit));
        return { url: `/admin/feed/reports?${p.toString()}`, method: "GET" };
      },
      providesTags: [{ type: "AdminFeedReports", id: "LIST" }],
    }),
    adminResolveFeedReport: builder.mutation({
      query: ({ rid, action, note }) => ({
        url: `/admin/feed/reports/${rid}`,
        method: "PATCH",
        body: { action, note },
      }),
      invalidatesTags: [
        { type: "AdminFeedReports", id: "LIST" },
        { type: "AdminFeed", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useAdminListFeedPostsQuery,
  useAdminPatchFeedPostMutation,
  useAdminDeleteFeedPostMutation,
  useAdminListFeedReportsQuery,
  useAdminResolveFeedReportMutation,
} = feedAdminApiSlice;
