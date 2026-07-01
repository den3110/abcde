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
        url: "/admin/news/run/v2",
        method: "POST",
      }),
      invalidatesTags: ["NewsCandidates"],
    }),
    getBlogPosts: builder.query({
      query: ({
        page = 1,
        limit = 50,
        status = "",
        keyword = "",
      } = {}) => {
        const params = { page, limit };
        if (status) params.status = status;
        if (keyword) params.keyword = keyword;

        return {
          url: "/admin/blog-posts",
          params,
        };
      },
      providesTags: ["BlogPosts"],
    }),
    getBlogPost: builder.query({
      query: (id) => ({
        url: `/admin/blog-posts/${id}`,
      }),
      providesTags: (_result, _error, id) => [
        { type: "BlogPosts", id },
      ],
    }),
    createBlogPost: builder.mutation({
      query: (body) => ({
        url: "/admin/blog-posts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["BlogPosts"],
    }),
    updateBlogPost: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/blog-posts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        "BlogPosts",
        { type: "BlogPosts", id: arg.id },
      ],
    }),
    deleteBlogPost: builder.mutation({
      query: (id) => ({
        url: `/admin/blog-posts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["BlogPosts"],
    }),
  }),
});

export const {
  useGetNewsSettingsQuery,
  useUpdateNewsSettingsMutation,
  useGetNewsCandidatesQuery,
  useRunNewsSyncMutation, // 🆕
  useGetBlogPostsQuery,
  useGetBlogPostQuery,
  useCreateBlogPostMutation,
  useUpdateBlogPostMutation,
  useDeleteBlogPostMutation,
} = newsAdminApiSlice;
