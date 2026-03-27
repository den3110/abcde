import { apiSlice } from "./apiSlice";

export const courtClustersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listCourtClusters: builder.query({
      query: ({ activeOnly } = {}) => ({
        url: "/admin/court-clusters",
        params: activeOnly ? { activeOnly: 1 } : undefined,
      }),
      transformResponse: (res) => res?.items || [],
      providesTags: (result = []) => [
        ...result.map((item) => ({ type: "CourtCluster", id: item._id })),
        { type: "CourtCluster", id: "LIST" },
      ],
    }),

    createCourtCluster: builder.mutation({
      query: (body) => ({
        url: "/admin/court-clusters",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "CourtCluster", id: "LIST" }],
    }),

    updateCourtCluster: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/court-clusters/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "CourtCluster", id },
        { type: "CourtCluster", id: "LIST" },
        { type: "CourtClusterRuntime", id },
      ],
    }),

    deleteCourtCluster: builder.mutation({
      query: (id) => ({
        url: `/admin/court-clusters/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "CourtCluster", id: "LIST" }],
    }),

    listCourtStations: builder.query({
      query: (clusterId) => `/admin/court-clusters/${clusterId}/courts`,
      transformResponse: (res) => res?.items || [],
      providesTags: (result = [], error, clusterId) => [
        ...result.map((item) => ({ type: "CourtStation", id: item._id })),
        { type: "CourtStation", id: `LIST:${clusterId}` },
      ],
    }),

    createCourtStation: builder.mutation({
      query: ({ clusterId, body }) => ({
        url: `/admin/court-clusters/${clusterId}/courts`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { clusterId }) => [
        { type: "CourtStation", id: `LIST:${clusterId}` },
        { type: "CourtClusterRuntime", id: clusterId },
      ],
    }),

    updateCourtStation: builder.mutation({
      query: ({ clusterId, stationId, body }) => ({
        url: `/admin/court-clusters/${clusterId}/courts/${stationId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { clusterId, stationId }) => [
        { type: "CourtStation", id: stationId },
        { type: "CourtStation", id: `LIST:${clusterId}` },
        { type: "CourtClusterRuntime", id: clusterId },
      ],
    }),

    deleteCourtStation: builder.mutation({
      query: ({ clusterId, stationId }) => ({
        url: `/admin/court-clusters/${clusterId}/courts/${stationId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { clusterId }) => [
        { type: "CourtStation", id: `LIST:${clusterId}` },
        { type: "CourtClusterRuntime", id: clusterId },
      ],
    }),

    getCourtClusterRuntime: builder.query({
      query: (clusterId) => `/admin/court-clusters/${clusterId}/runtime`,
      providesTags: (result, error, clusterId) => [{ type: "CourtClusterRuntime", id: clusterId }],
    }),

    assignMatchToCourtStation: builder.mutation({
      query: ({ stationId, matchId }) => ({
        url: `/admin/court-stations/${stationId}/assign-match`,
        method: "POST",
        body: { matchId },
      }),
      invalidatesTags: (result, error, { stationId }) => {
        const clusterId = result?.station?.clusterId || result?.match?.courtClusterId;
        return [
          { type: "CourtStation", id: result?.station?._id || result?.station?.id || stationId },
          ...(clusterId ? [{ type: "CourtClusterRuntime", id: clusterId }] : []),
        ];
      },
    }),

    freeCourtStation: builder.mutation({
      query: (stationId) => ({
        url: `/admin/court-stations/${stationId}/free`,
        method: "POST",
      }),
      invalidatesTags: (result, error, stationId) => {
        const clusterId = result?.station?.clusterId;
        return [
          { type: "CourtStation", id: result?.station?._id || result?.station?.id || stationId },
          ...(clusterId ? [{ type: "CourtClusterRuntime", id: clusterId }] : []),
        ];
      },
    }),

    getCourtStationCurrentMatch: builder.query({
      query: (stationId) => `/admin/court-stations/${stationId}/current-match`,
      providesTags: (result, error, stationId) => [{ type: "CourtStation", id: stationId }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListCourtClustersQuery,
  useCreateCourtClusterMutation,
  useUpdateCourtClusterMutation,
  useDeleteCourtClusterMutation,
  useListCourtStationsQuery,
  useCreateCourtStationMutation,
  useUpdateCourtStationMutation,
  useDeleteCourtStationMutation,
  useGetCourtClusterRuntimeQuery,
  useAssignMatchToCourtStationMutation,
  useFreeCourtStationMutation,
  useGetCourtStationCurrentMatchQuery,
} = courtClustersApiSlice;
