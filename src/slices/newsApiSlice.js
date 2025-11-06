// src/features/news/newsApiSlice.js
import { apiSlice } from "./apiSlice";

export const newsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/news?limit=20
    getNewsList: builder.query({
      query: (limit = 20) => ({
        url: "/news",
        params: { limit },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((item) => ({
                type: "News",
                id: item.slug,
              })),
              { type: "News", id: "LIST" },
            ]
          : [{ type: "News", id: "LIST" }],
    }),

    // GET /api/news/:slug
    getNewsBySlug: builder.query({
      query: (slug) => ({
        url: `/news/${slug}`,
      }),
      providesTags: (result, error, slug) => [{ type: "News", id: slug }],
    }),
  }),
});

export const { useGetNewsListQuery, useGetNewsBySlugQuery } = newsApiSlice;
