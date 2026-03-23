import { apiSlice } from "./apiSlice";

export const adminLivePlaybackApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminLivePlaybackConfig: builder.query({
      query: () => ({
        url: "/admin/live-playback/config",
        method: "GET",
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

export const {
  useGetAdminLivePlaybackConfigQuery,
  useUpdateAdminLivePlaybackConfigMutation,
} = adminLivePlaybackApiSlice;
