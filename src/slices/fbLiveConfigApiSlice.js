import { apiSlice } from "./apiSlice"; // giả định bạn đã có base apiSlice

export const fbLiveConfigApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFbLiveConfig: builder.query({
      query: () => ({ url: "/admin/fb-live-config" }),
      providesTags: ["FbLiveConfig"],
    }),
    updateFbLiveConfig: builder.mutation({
      query: (body) => ({
        url: "/admin/fb-live-config",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["FbLiveConfig"],
    }),
  }),
});

export const { useGetFbLiveConfigQuery, useUpdateFbLiveConfigMutation } = fbLiveConfigApiSlice;
