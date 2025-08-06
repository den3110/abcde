// src/slices/authApiSlice.js
import { apiSlice } from "./apiSlice";

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({
        url: "/admin/login",
        method: "POST",
        body,
      }),
    }),
    verify: builder.query({
      query: () => "/auth/verify",
      // 401 đã được baseQuery auto-logout; ta chỉ cần dữ liệu
    }),
  }),
});

export const { useLoginMutation, useVerifyQuery } = authApiSlice;
