import { apiSlice } from "./apiSlice";
import { setCredentials } from "./authSlice";

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
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const prevToken = getState()?.auth?.userInfo?.token || null;
          dispatch(
            setCredentials({
              user: data?.user || null,
              token: data?.token || prevToken,
            }),
          );
        } catch {
          // noop
        }
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
