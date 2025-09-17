// src/slices/versionApiSlice.js
import { apiSlice } from "./apiSlice";

const VERSION_URL = "/app/version";

export const versionApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // lấy config theo platform (ios | android). Nếu không truyền -> server fallback "all"
    getAppVersion: builder.query({
      query: (platform) => {
        const p = platform ? String(platform).toLowerCase() : "";
        return p ? `${VERSION_URL}?platform=${p}` : VERSION_URL;
      },
      providesTags: (result, error, arg) => [{ type: "AppVersion", id: arg || "ALL" }],
      keepUnusedDataFor: 0,
    }),

    // admin upsert cấu hình
    upsertAppVersion: builder.mutation({
      // body: { platform, latestVersion, latestBuild, minSupportedBuild, storeUrl, rollout, blockedBuilds, changelog }
      query: (body) => ({
        url: VERSION_URL,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: "AppVersion", id: "ALL" },
        { type: "AppVersion", id: "ios" },
        { type: "AppVersion", id: "android" },
      ],
    }),
  }),
});

export const { useGetAppVersionQuery, useUpsertAppVersionMutation } = versionApiSlice;
