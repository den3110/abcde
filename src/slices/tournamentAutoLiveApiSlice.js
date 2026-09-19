import { apiSlice } from "./apiSlice";

export const tournamentAutoLiveApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAutoLiveSessions: builder.query({
      query: ({ tournamentId, status } = {}) => {
        const p = new URLSearchParams();
        if (tournamentId) p.set("tournamentId", tournamentId);
        if (status) p.set("status", status);
        return { url: `/tournament-auto-live/sessions?${p.toString()}` };
      },
      providesTags: ["AutoLive"],
    }),
    startAutoLive: builder.mutation({
      query: (body) => ({ url: `/tournament-auto-live/start`, method: "POST", body }),
      invalidatesTags: ["AutoLive"],
    }),
    stopAutoLive: builder.mutation({
      query: (id) => ({ url: `/tournament-auto-live/${id}/stop`, method: "POST" }),
      invalidatesTags: ["AutoLive"],
    }),
    // Court + cam Imou cho giải đấu (reuse endpoint từ live-app để lấy court +
    // metadata, backend đã có sẵn cho native-live-app).
    listTournamentCourtsForAutoLive: builder.query({
      query: (tournamentId) => `/live-app/tournaments/${tournamentId}/courts?includeImou=1`,
    }),
    listAdminFbPages: builder.query({
      query: () => `/live-app/facebook-pages`,
    }),
  }),
});

export const {
  useListAutoLiveSessionsQuery,
  useStartAutoLiveMutation,
  useStopAutoLiveMutation,
  useListTournamentCourtsForAutoLiveQuery,
  useListAdminFbPagesQuery,
} = tournamentAutoLiveApiSlice;
