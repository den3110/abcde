import { apiSlice } from "./apiSlice";

export const adminLivePlaybackApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminLivePlaybackConfig: builder.query({
      query: (arg = {}) => ({
        url: "/admin/live-playback/config",
        method: "GET",
        params: arg?.forceHealth
          ? {
              forceHealth: 1,
              _t: arg?.refreshToken || Date.now(),
            }
          : undefined,
      }),
      providesTags: ["AdminLivePlayback"],
    }),
    updateAdminLivePlaybackConfig: builder.mutation({
      query: (body) => ({
        url: "/admin/live-playback/config",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["AdminLivePlayback"],
    }),
  }),
});

export const { useGetAdminLivePlaybackConfigQuery, useUpdateAdminLivePlaybackConfigMutation } =
  adminLivePlaybackApiSlice;
