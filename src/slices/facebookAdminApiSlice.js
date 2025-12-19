// src/slices/facebookAdminApiSlice.js
import { apiSlice } from "./apiSlice";

export const facebookAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    fbPageInfoBulk: builder.mutation({
      query: ({ tokens, fields }) => ({
        url: "/fb/page-info/bulk",
        method: "POST",
        body: { tokens, fields },
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useFbPageInfoBulkMutation } = facebookAdminApiSlice;
