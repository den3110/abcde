// slices/otaApiSlice.js
import { apiSlice } from "./apiSlice";

export const otaApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all versions for a platform
    getOtaVersions: builder.query({
      query: (platform) => ({
        url: `/ota/versions/${platform}`,
        method: "GET",
      }),
      transformResponse: (res) => res?.versions ?? res,
      providesTags: (result, error, platform) => [{ type: "OTA_VERSIONS", id: platform }],
    }),

    // Get latest version
    getOtaLatest: builder.query({
      query: (platform) => ({
        url: `/ota/latest/${platform}`,
        method: "GET",
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result, error, platform) => [{ type: "OTA_LATEST", id: platform }],
    }),

    // Get analytics
    getOtaAnalytics: builder.query({
      query: ({ platform, days = 7 }) => ({
        url: `/ota/analytics/${platform}`,
        method: "GET",
        params: { days },
      }),
      transformResponse: (res) => res?.data ?? res,
      providesTags: (result, error, { platform }) => [{ type: "OTA_ANALYTICS", id: platform }],
    }),

    // Check for update (for testing)
    checkOtaUpdate: builder.query({
      query: ({ platform, bundleVersion, appVersion }) => ({
        url: "/ota/check",
        method: "GET",
        params: { platform, bundleVersion, appVersion },
      }),
      transformResponse: (res) => res?.data ?? res,
    }),

    // Upload bundle
    uploadOtaBundle: builder.mutation({
      query: ({ platform, version, description, minAppVersion, mandatory, file }) => {
        const formData = new FormData();
        formData.append("bundle", file);
        formData.append("platform", platform);
        formData.append("version", version);
        formData.append("description", description || "");
        formData.append("minAppVersion", minAppVersion || "1.0.0");
        formData.append("mandatory", mandatory ? "true" : "false");

        return {
          url: "/ota/upload",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (result, error, { platform }) => [
        { type: "OTA_VERSIONS", id: platform },
        { type: "OTA_LATEST", id: platform },
        { type: "OTA_ANALYTICS", id: platform },
      ],
    }),

    // Rollback to version
    rollbackOta: builder.mutation({
      query: ({ platform, version, reason }) => ({
        url: "/ota/rollback",
        method: "POST",
        body: { platform, version, reason },
      }),
      invalidatesTags: (result, error, { platform }) => [
        { type: "OTA_VERSIONS", id: platform },
        { type: "OTA_LATEST", id: platform },
      ],
    }),

    // Deactivate version
    deactivateOtaVersion: builder.mutation({
      query: ({ platform, version }) => ({
        url: "/ota/deactivate",
        method: "POST",
        body: { platform, version },
      }),
      invalidatesTags: (result, error, { platform }) => [
        { type: "OTA_VERSIONS", id: platform },
        { type: "OTA_ANALYTICS", id: platform },
      ],
    }),

    // Report update status (client calls after update attempt)
    reportOtaStatus: builder.mutation({
      query: ({ logId, status, errorMessage, errorCode, duration }) => ({
        url: "/ota/report-status",
        method: "POST",
        body: { logId, status, errorMessage, errorCode, duration },
      }),
    }),
  }),
});

export const {
  useGetOtaVersionsQuery,
  useGetOtaLatestQuery,
  useGetOtaAnalyticsQuery,
  useLazyCheckOtaUpdateQuery,
  useUploadOtaBundleMutation,
  useRollbackOtaMutation,
  useDeactivateOtaVersionMutation,
  useReportOtaStatusMutation,
} = otaApiSlice;
