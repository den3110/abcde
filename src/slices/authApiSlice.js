import { apiSlice } from "./apiSlice";

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Admin login ───
    login: builder.mutation({
      query: (credentials) => ({
        url: "/admin/login",
        method: "POST",
        body: credentials,
      }),
      // on success you'll dispatch setCredentials from your authSlice
    }),

    // ─── Verify current user (and pull fresh JWT from header) ───
    verify: builder.query({
      query: () => "/auth/verify",
      // Extract the new token from the Authorization header if provided
      transformResponse: (response, meta) => {
        const authHeader = meta.response.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
        return {
          user: response,
          token,
        };
      },
    }),

    // ─── Logout (clears HTTP-only cookie on the server) ───
    logout: builder.mutation({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
  }),
});

export const { useLoginMutation, useVerifyQuery, useLogoutMutation } = authApiSlice;
