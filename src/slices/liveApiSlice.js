import { apiSlice } from "./apiSlice";

export const liveApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    adminListLiveSessions: builder.query({
      query: ({
        status = "live",
        q = "",
        platform = "",
        tournamentId = "",
        page = 1,
        limit = 20,
        includePages = false,
      } = {}) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (q) params.set("q", q);
        if (platform) params.set("platform", platform);
        if (tournamentId) params.set("tournamentId", tournamentId);
        if (page) params.set("page", String(page));
        if (limit) params.set("limit", String(limit));
        if (includePages) params.set("includePages", "1");

        return {
          url: `/admin/l/live-sessions/all?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: () => [{ type: "LiveSessions", id: "LIST" }],
    }),
    getFbVodDriveMonitor: builder.query({
      query: ({ range = "7d", status = "all", q = "", page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (range) params.set("range", String(range));
        if (status) params.set("status", String(status));
        if (q) params.set("q", q);
        if (page) params.set("page", String(page));
        if (limit) params.set("limit", String(limit));

        return {
          url: `/admin/fb-vod-monitor?${params.toString()}`,
          method: "GET",
        };
      },
      keepUnusedDataFor: 5,
      providesTags: [{ type: "FbVodMonitor", id: "LIST" }],
    }),
    ensureFbVodDriveExport: builder.mutation({
      query: (matchId) => ({
        url: `/admin/fb-vod-monitor/${matchId}/ensure-export`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "FbVodMonitor", id: "LIST" }],
    }),
    getLiveRecordingMonitor: builder.query({
      query: () => ({
        url: "/live/recordings/v2/admin/monitor",
        method: "GET",
      }),
      keepUnusedDataFor: 5,
      providesTags: [{ type: "LiveRecordingMonitor", id: "LIST" }],
    }),
    getLiveRecordingWorkerHealth: builder.query({
      query: () => ({
        url: "/live/recordings/v2/admin/worker-health",
        method: "GET",
      }),
      keepUnusedDataFor: 5,
    }),
    getLiveRecordingAiCommentaryMonitor: builder.query({
      query: () => ({
        url: "/live/recordings/v2/admin/commentary/monitor",
        method: "GET",
      }),
      keepUnusedDataFor: 5,
      providesTags: [{ type: "LiveRecordingAiCommentaryMonitor", id: "LIST" }],
    }),
    retryLiveRecordingExport: builder.mutation({
      query: (recordingId) => ({
        url: `/live/recordings/v2/admin/${recordingId}/retry-export`,
        method: "POST",
      }),
    }),
    forceLiveRecordingExport: builder.mutation({
      query: (recordingId) => ({
        url: `/live/recordings/v2/admin/${recordingId}/force-export`,
        method: "POST",
      }),
    }),
    queueLiveRecordingAiCommentary: builder.mutation({
      query: (recordingId) => ({
        url: `/live/recordings/v2/admin/${recordingId}/commentary`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "LiveRecordingAiCommentaryMonitor", id: "LIST" }],
    }),
    rerenderLiveRecordingAiCommentary: builder.mutation({
      query: (recordingId) => ({
        url: `/live/recordings/v2/admin/${recordingId}/commentary/rerender`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "LiveRecordingAiCommentaryMonitor", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useAdminListLiveSessionsQuery,
  useEnsureFbVodDriveExportMutation,
  useForceLiveRecordingExportMutation,
  useGetFbVodDriveMonitorQuery,
  useGetLiveRecordingAiCommentaryMonitorQuery,
  useGetLiveRecordingMonitorQuery,
  useGetLiveRecordingWorkerHealthQuery,
  useQueueLiveRecordingAiCommentaryMutation,
  useRerenderLiveRecordingAiCommentaryMutation,
  useRetryLiveRecordingExportMutation,
} = liveApiSlice;
