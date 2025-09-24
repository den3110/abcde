// src/slices/adminVersionsApiSlice.js
import { apiSlice } from "./apiSlice";

export const adminVersionsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /admin/versions/stats?platform=
    getVersionStats: builder.query({
      // arg: { platform?: "ios"|"android"|"" }
      query: (arg = {}) => {
        const params = new URLSearchParams();
        if (arg.platform) params.set("platform", arg.platform);
        const qs = params.toString();
        return `/admin/versions/stats${qs ? `?${qs}` : ""}`;
      },
      // Tag theo platform để tách cache
      providesTags: (_result, _err, arg) => [
        { type: "AppVersion", id: `ADMIN_STATS_${arg?.platform || "all"}` },
      ],
      keepUnusedDataFor: 0,
    }),

    // GET /admin/versions/by-user?platform=&type=&q=&limit=&includeDevices=
    getUsersVersion: builder.query({
      /**
       * arg: {
       *   platform?: ""|"ios"|"android",
       *   type?: "all"|"soft"|"force",
       *   q?: string,
       *   limit?: number,
       *   includeDevices?: boolean
       * }
       */
      query: ({ platform = "", type = "all", q = "", limit = 50, includeDevices = true } = {}) => {
        const params = new URLSearchParams();
        if (platform) params.set("platform", platform);
        if (type) params.set("type", type);
        if (q) params.set("q", q);
        if (limit) params.set("limit", String(limit));
        // luôn gửi explicit để backend quyết định (giảm bất ngờ)
        params.set("includeDevices", includeDevices ? "true" : "false");
        return `/admin/versions/by-user?${params.toString()}`;
      },
      // Tag theo combo tham số để tách cache giữa các filter
      providesTags: (_result, _err, arg) => [
        {
          type: "AppVersion",
          id: `ADMIN_USERS_${arg?.platform || "all"}_${arg?.type || "all"}`,
        },
      ],
      keepUnusedDataFor: 0,
      // Nếu muốn tự động refetch khi arg đổi:
      // refetchOnMountOrArgChange: true,
    }),
  }),
});

export const { useGetVersionStatsQuery, useGetUsersVersionQuery } = adminVersionsApiSlice;
