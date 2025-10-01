import { apiSlice } from "./apiSlice"; // file base của bạn

export const adminStatsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPresenceSummary: builder.query({
      query: () => ({ url: "/admin/stats/presence", method: "GET" }),
      providesTags: ["ADMIN_PRESENCE"],
    }),

    listPresenceUsers: builder.query({
      query: () => ({ url: "/admin/stats/presence/users", method: "GET" }),
      providesTags: ["ADMIN_PRESENCE_USERS"],
    }),
    searchPresenceUsers: builder.query({
      query: (q) => ({
        url: `/admin/stats/presence/search?q=${encodeURIComponent(q)}`,
        method: "GET",
      }),
    }),
    getPresenceOfUser: builder.query({
      query: (id) => ({ url: `/admin/stats/presence/user/${id}`, method: "GET" }),
    }),
  }),
});

export const {
  useGetPresenceSummaryQuery,
  useListPresenceUsersQuery,
  useLazySearchPresenceUsersQuery,
  useLazyGetPresenceOfUserQuery,
} = adminStatsApiSlice;
