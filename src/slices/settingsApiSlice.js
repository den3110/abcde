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
    getRecordingDriveStatus: builder.query({
      query: () => ({ url: "/admin/recording-drive/status" }),
      providesTags: ["RecordingDriveStatus"],
    }),
    recordingDriveOAuthInit: builder.query({
      query: () => ({ url: "/admin/recording-drive/oauth/init" }),
    }),
    recordingDrivePickerSession: builder.query({
      query: () => ({ url: "/admin/recording-drive/picker/session" }),
    }),
    disconnectRecordingDrive: builder.mutation({
      query: () => ({
        url: "/admin/recording-drive/disconnect",
        method: "POST",
      }),
      invalidatesTags: ["RecordingDriveStatus"],
    }),
    // Overlay generator API key (ANTHROPIC_API_KEY) — quản lý ngay trong Cài đặt hệ thống
    getOverlayGeneratorKeyStatus: builder.query({
      query: () => ({ url: "/admin/overlay-generator/keystatus" }),
      providesTags: ["OverlayGeneratorKey"],
    }),
    setOverlayGeneratorKey: builder.mutation({
      query: ({ apiKey }) => ({
        url: "/admin/overlay-generator/setkey",
        method: "POST",
        body: { apiKey },
      }),
      invalidatesTags: ["OverlayGeneratorKey"],
    }),
    // Zalo ZNS — gửi OTP thử + làm mới access_token
    testZaloZns: builder.mutation({
      query: ({ phone }) => ({
        url: "/admin/zalo-zns/test",
        method: "POST",
        body: { phone },
      }),
    }),
    refreshZaloZnsToken: builder.mutation({
      query: () => ({
        url: "/admin/zalo-zns/refresh-token",
        method: "POST",
      }),
      invalidatesTags: ["SystemSettings"],
    }),
  }),
});

export const {
  useGetSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
  useGetRecordingDriveStatusQuery,
  useLazyRecordingDriveOAuthInitQuery,
  useLazyRecordingDrivePickerSessionQuery,
  useDisconnectRecordingDriveMutation,
  useGetOverlayGeneratorKeyStatusQuery,
  useSetOverlayGeneratorKeyMutation,
  useTestZaloZnsMutation,
  useRefreshZaloZnsTokenMutation,
} = settingsApiSlice;
