// src/slices/youtubeAdminApiSlice.js
import { apiSlice } from "./apiSlice";

export const youtubeAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    ytInit: builder.query({
      query: () => ({ url: "/admin/youtube/init" }),
    }),
    ytGetStreamKey: builder.query({
      query: () => ({ url: "/admin/youtube/stream-key" }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useLazyYtInitQuery,
  useLazyYtGetStreamKeyQuery,
  useYtInitQuery,
  useYtGetStreamKeyQuery,
} = youtubeAdminApiSlice;
