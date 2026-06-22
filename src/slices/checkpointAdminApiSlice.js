import { apiSlice } from "./apiSlice";

const CHECKPOINT_URL = "/checkpoints";

const cleanParams = (params = {}) =>
  Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== "") acc[key] = value;
    return acc;
  }, {});

export const checkpointAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCheckpointAdminOverview: builder.query({
      query: ({ days = 30 } = {}) => ({
        url: `${CHECKPOINT_URL}/admin/overview`,
        params: cleanParams({ days }),
      }),
      providesTags: ["CheckpointAdmin"],
      keepUnusedDataFor: 15,
    }),
    getCheckpointAdminPolicy: builder.query({
      query: () => `${CHECKPOINT_URL}/policy/summary`,
      providesTags: ["CheckpointAdmin"],
      keepUnusedDataFor: 60,
    }),
    getCheckpointAdminSettings: builder.query({
      query: () => `${CHECKPOINT_URL}/admin/settings`,
      providesTags: ["CheckpointAdmin"],
      keepUnusedDataFor: 30,
    }),
    updateCheckpointAdminSettings: builder.mutation({
      query: (body) => ({
        url: `${CHECKPOINT_URL}/admin/settings`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["CheckpointAdmin", "CheckpointSession", "CheckpointEvent"],
    }),
    getCheckpointAdminSessions: builder.query({
      query: ({
        page = 1,
        pageSize = 20,
        q = "",
        status = "",
        level = "",
        channel = "",
        deliveryMethod = "",
        confidence = "",
        days = "",
      } = {}) => ({
        url: `${CHECKPOINT_URL}/admin/sessions`,
        params: cleanParams({
          page,
          pageSize,
          q,
          status,
          level,
          channel,
          deliveryMethod,
          confidence,
          days,
        }),
      }),
      providesTags: (result) => [
        "CheckpointSession",
        ...(result?.sessions || []).map((session) => ({
          type: "CheckpointSession",
          id: session._id,
        })),
      ],
      keepUnusedDataFor: 10,
    }),
    getCheckpointAdminEvents: builder.query({
      query: ({
        page = 1,
        pageSize = 30,
        q = "",
        category = "",
        outcome = "",
        severity = "",
        routeGroup = "",
        days = "",
      } = {}) => ({
        url: `${CHECKPOINT_URL}/admin/events`,
        params: cleanParams({
          page,
          pageSize,
          q,
          category,
          outcome,
          severity,
          routeGroup,
          days,
        }),
      }),
      providesTags: ["CheckpointEvent"],
      keepUnusedDataFor: 10,
    }),
    getCheckpointMandates: builder.query({
      query: ({ page = 1, pageSize = 20, q = "", status = "", level = "" } = {}) => ({
        url: `${CHECKPOINT_URL}/admin/mandates`,
        params: cleanParams({ page, pageSize, q, status, level }),
      }),
      providesTags: ["CheckpointAdmin"],
      keepUnusedDataFor: 10,
    }),
    createCheckpointMandate: builder.mutation({
      query: (body) => ({
        url: `${CHECKPOINT_URL}/admin/mandates`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["CheckpointAdmin", "CheckpointSession", "CheckpointEvent"],
    }),
    cancelCheckpointMandate: builder.mutation({
      query: ({ id, note = "" }) => ({
        url: `${CHECKPOINT_URL}/admin/mandates/${id}/cancel`,
        method: "POST",
        body: { note },
      }),
      invalidatesTags: ["CheckpointAdmin", "CheckpointSession", "CheckpointEvent"],
    }),
    getCheckpointAdminSessionDetail: builder.query({
      query: (id) => `${CHECKPOINT_URL}/admin/sessions/${id}`,
      providesTags: (result, error, id) => [{ type: "CheckpointSession", id }],
      keepUnusedDataFor: 10,
    }),
    getCheckpointSubjectInsight: builder.query({
      query: ({ userId = "", ip = "", deviceId = "", days = 30 } = {}) => ({
        url: `${CHECKPOINT_URL}/admin/subjects/insight`,
        params: cleanParams({ userId, ip, deviceId, days }),
      }),
      providesTags: ["CheckpointAdmin"],
      keepUnusedDataFor: 10,
    }),
    simulateCheckpointRisk: builder.mutation({
      query: (body) => ({
        url: `${CHECKPOINT_URL}/admin/simulate`,
        method: "POST",
        body,
      }),
    }),
    resolveCheckpointAdminSession: builder.mutation({
      query: ({ id, action, note = "" }) => ({
        url: `${CHECKPOINT_URL}/admin/sessions/${id}/resolve`,
        method: "POST",
        body: { action, note },
      }),
      invalidatesTags: ["CheckpointAdmin", "CheckpointSession", "CheckpointEvent"],
    }),
  }),
});

export const {
  useGetCheckpointAdminOverviewQuery,
  useGetCheckpointAdminPolicyQuery,
  useGetCheckpointAdminSettingsQuery,
  useGetCheckpointAdminSessionsQuery,
  useGetCheckpointAdminEventsQuery,
  useGetCheckpointMandatesQuery,
  useCreateCheckpointMandateMutation,
  useCancelCheckpointMandateMutation,
  useGetCheckpointAdminSessionDetailQuery,
  useGetCheckpointSubjectInsightQuery,
  useSimulateCheckpointRiskMutation,
  useUpdateCheckpointAdminSettingsMutation,
  useResolveCheckpointAdminSessionMutation,
} = checkpointAdminApiSlice;
