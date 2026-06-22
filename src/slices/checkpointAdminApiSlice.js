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
  useGetCheckpointAdminSessionsQuery,
  useGetCheckpointAdminEventsQuery,
  useResolveCheckpointAdminSessionMutation,
} = checkpointAdminApiSlice;
