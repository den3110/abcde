// src/slices/adminVersionsApiSlice.js
import { apiSlice } from "./apiSlice";

export const adminVersionsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getVersionStats: builder.query({
      // arg: { platform?: "ios"|"android"|"" }
      query: (arg = {}) => {
        const p = arg.platform ? `?platform=${arg.platform}` : "";
        return `/admin/versions/stats${p}`;
      },
      providesTags: [{ type: "AppVersion", id: "ADMIN_STATS" }],
      keepUnusedDataFor: 0,
    }),
    getUsersVersion: builder.query({
      // arg: { platform?: "ios"|"android"|""; type?: "all"|"soft"|"force"; q?: string; limit?: number }
      query: ({ platform = "", type = "all", q = "", limit = 50 } = {}) => {
        const params = new URLSearchParams();
        if (platform) params.set("platform", platform);
        if (type) params.set("type", type);
        if (q) params.set("q", q);
        if (limit) params.set("limit", String(limit));
        return `/admin/versions/by-user?${params.toString()}`;
      },
      providesTags: [{ type: "AppVersion", id: "ADMIN_USERS" }],
      keepUnusedDataFor: 0,
    }),
  }),
});

export const { useGetVersionStatsQuery, useGetUsersVersionQuery } = adminVersionsApiSlice;
