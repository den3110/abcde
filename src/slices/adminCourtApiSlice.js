// src/slices/adminCourtApiSlice.js
import { apiSlice } from "./apiSlice";

export const adminCourtApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Upsert danh sách sân theo BRACKET (names[] hoặc count)
    upsertCourts: builder.mutation({
      // { tournamentId, bracket, names?: string[], count?: number }
      query: ({ tournamentId, bracket, names, count }) => ({
        url: `/admin/tournaments/${tournamentId}/courts`,
        method: "POST",
        body: {
          bracket,
          ...(Array.isArray(names) && names.length ? { names } : {}),
          ...(Number.isInteger(count) ? { count } : {}),
        },
      }),
      transformResponse: (res) => res?.items ?? res,
      invalidatesTags: ["ADMIN_COURTS", "ADMIN_QUEUE"],
    }),

    // Build hàng đợi vòng bảng theo lượt A1,B1,C1,D1… rồi A2,B2…
    buildGroupsQueue: builder.mutation({
      // { tournamentId, bracket }
      query: ({ tournamentId, bracket }) => ({
        url: `/admin/tournaments/${tournamentId}/queue/groups/build`,
        method: "POST",
        body: { bracket },
      }),
      transformResponse: (res) => res ?? {},
      invalidatesTags: ["ADMIN_QUEUE"],
    }),

    // HTTP assign next (fallback nếu muốn, mặc định dùng socket)
    assignNextHttp: builder.mutation({
      // { tournamentId, courtId, bracket }
      query: ({ tournamentId, courtId, bracket }) => ({
        url: `/admin/tournaments/${tournamentId}/courts/${courtId}/assign-next`,
        method: "POST",
        body: { bracket },
      }),
      transformResponse: (res) => res ?? {},
      invalidatesTags: ["ADMIN_QUEUE", "ADMIN_COURTS"],
    }),

    // Free court
    freeCourtHttp: builder.mutation({
      // { tournamentId, courtId }
      query: ({ tournamentId, courtId }) => ({
        url: `/admin/tournaments/${tournamentId}/courts/${courtId}/free`,
        method: "POST",
      }),
      transformResponse: (res) => res ?? {},
      invalidatesTags: ["ADMIN_QUEUE", "ADMIN_COURTS"],
    }),

    // Lấy scheduler state theo BRACKET (fallback/polling)
    getSchedulerState: builder.query({
      // { tournamentId, bracket }
      query: ({ tournamentId, bracket }) => ({
        url: `/admin/tournaments/${tournamentId}/courts/state?bracket=${encodeURIComponent(
          bracket
        )}`,
        method: "GET",
      }),
      transformResponse: (res) => res ?? { courts: [], matches: [] },
      providesTags: ["ADMIN_QUEUE", "ADMIN_COURTS"],
    }),
  }),
});

export const {
  useUpsertCourtsMutation,
  useBuildGroupsQueueMutation,
  useAssignNextHttpMutation,
  useFreeCourtHttpMutation,
  useGetSchedulerStateQuery,
} = adminCourtApiSlice;
