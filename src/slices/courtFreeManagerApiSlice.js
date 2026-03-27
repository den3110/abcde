import { apiSlice } from "./apiSlice";

function collectStationTags(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.flatMap((tournament) =>
    Array.isArray(tournament?.clusters)
      ? tournament.clusters.flatMap((cluster) =>
          Array.isArray(cluster?.stations)
            ? cluster.stations.map((station) => ({
                type: "CourtStation",
                id: station?._id,
              }))
            : []
        )
      : []
  );
}

export const courtFreeManagerApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCourtFreeManager: builder.query({
      query: ({ includeInactive = false } = {}) => ({
        url: "/admin/court-stations/free-manager",
        params: includeInactive ? { includeInactive: 1 } : undefined,
      }),
      transformResponse: (res) => ({
        items: Array.isArray(res?.items) ? res.items : [],
        totals: res?.totals || {},
      }),
      providesTags: (result) => [
        { type: "CourtFreeManager", id: "LIST" },
        ...collectStationTags(result),
      ],
    }),

    forceFreeCourtStation: builder.mutation({
      query: (stationId) => ({
        url: `/admin/court-stations/${stationId}/force-free`,
        method: "POST",
      }),
      invalidatesTags: (result, error, stationId) => {
        const clusterId = result?.clusterId || result?.station?.clusterId;
        return [
          { type: "CourtFreeManager", id: "LIST" },
          { type: "CourtStation", id: stationId },
          ...(clusterId
            ? [{ type: "CourtClusterRuntime", id: clusterId }]
            : []),
        ];
      },
    }),

    forceReleaseCourtStationPresence: builder.mutation({
      query: (stationId) => ({
        url: `/admin/court-stations/${stationId}/force-release-presence`,
        method: "POST",
      }),
      invalidatesTags: (result, error, stationId) => {
        const clusterId = result?.clusterId;
        return [
          { type: "CourtFreeManager", id: "LIST" },
          { type: "CourtStation", id: stationId },
          ...(clusterId
            ? [{ type: "CourtClusterRuntime", id: clusterId }]
            : []),
        ];
      },
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetCourtFreeManagerQuery,
  useForceFreeCourtStationMutation,
  useForceReleaseCourtStationPresenceMutation,
} = courtFreeManagerApiSlice;
