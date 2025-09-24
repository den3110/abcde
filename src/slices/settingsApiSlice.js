// src/slices/settingsApiSlice.js
import { apiSlice } from "./apiSlice"; // dùng chung base như dự án bạn

export const settingsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSystemSettings: builder.query({
      query: () => ({ url: "/admin/settings" }),
      providesTags: ["SystemSettings"],
    }),
    updateSystemSettings: builder.mutation({
      query: (body) => ({
        url: "/admin/settings",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["SystemSettings"],
    }),
  }),
});

export const { useGetSystemSettingsQuery, useUpdateSystemSettingsMutation } = settingsApiSlice;
