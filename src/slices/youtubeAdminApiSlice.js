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
    // Test live YouTube nhiều luồng cùng lúc
    ytLiveTestSessions: builder.query({
      query: () => ({ url: "/admin/youtube/live-test/sessions" }),
      providesTags: ["YtLiveTest"],
    }),
    startYtLiveTest: builder.mutation({
      query: (body) => ({ url: "/admin/youtube/live-test/start", method: "POST", body }),
      invalidatesTags: ["YtLiveTest"],
    }),
    stopYtLiveTest: builder.mutation({
      query: (sessionId) => ({ url: `/admin/youtube/live-test/${sessionId}/stop`, method: "POST" }),
      invalidatesTags: ["YtLiveTest"],
    }),
    stopAllYtLiveTest: builder.mutation({
      query: () => ({ url: "/admin/youtube/live-test/stop-all", method: "POST" }),
      invalidatesTags: ["YtLiveTest"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLazyYtInitQuery,
  useLazyYtGetStreamKeyQuery,
  useYtInitQuery,
  useYtGetStreamKeyQuery,
  useYtLiveTestSessionsQuery,
  useStartYtLiveTestMutation,
  useStopYtLiveTestMutation,
  useStopAllYtLiveTestMutation,
} = youtubeAdminApiSlice;
