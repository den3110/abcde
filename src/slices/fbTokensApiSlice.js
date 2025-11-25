// src/slices/fbTokensApiSlice.js
import { apiSlice } from "./apiSlice";

export const fbTokensApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listFbTokens: builder.query({
      query: ({ q = "", status = "", busy = "" } = {}) =>
        `/fb-tokens?q=${encodeURIComponent(q)}&status=${status}&busy=${busy}`,
      keepUnusedDataFor: 30,
    }),
    checkOneFbToken: builder.mutation({
      query: (id) => ({ url: `/fb-tokens/${id}/check`, method: "POST" }),
    }),
    checkAllFbTokens: builder.mutation({
      query: () => ({ url: `/fb-tokens/~batch/check-all`, method: "POST" }),
    }),
    markNeedsReauth: builder.mutation({
      query: (id) => ({ url: `/fb-tokens/${id}/mark-reauth`, method: "POST" }),
    }),
    clearBusyFlag: builder.mutation({
      query: (id) => ({ url: `/fb-tokens/${id}/clear-busy`, method: "POST" }),
    }),
    // ➕ NEW:
    disableFbToken: builder.mutation({
      query: (id) => ({
        url: `/fb-tokens/${id}/disable`,
        method: "POST",
      }),
    }),
    enableFbToken: builder.mutation({
      query: (id) => ({
        url: `/fb-tokens/${id}/enable`,
        method: "POST",
      }),
    }),
  }),
});

export const {
  useListFbTokensQuery,
  useCheckOneFbTokenMutation,
  useCheckAllFbTokensMutation,
  useMarkNeedsReauthMutation,
  useClearBusyFlagMutation,
  useDisableFbTokenMutation,
  useEnableFbTokenMutation,
} = fbTokensApi;
