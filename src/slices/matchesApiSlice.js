import { apiSlice } from "./apiSlice";

export const matchesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMatchAdmin: builder.query({
      query: (id) => ({ url: `/admin/matches/a/${id}` }),
      transformResponse: (res) => res.match,
      providesTags: (result, err, id) => [{ type: "Match", id }],
    }),
    getMatchLogs: builder.query({
      query: (id) => ({ url: `/admin/matches/${id}/logs` }),
      transformResponse: (res) => res.logs || [],
      providesTags: (r, e, id) => [{ type: "MatchLogs", id }],
    }),
    getMatchRatingChanges: builder.query({
      query: (id) => ({ url: `/admin/matches/${id}/rating-changes` }),
      transformResponse: (res) => res.list || [],
      providesTags: (r, e, id) => [{ type: "MatchRating", id }],
    }),
    applyMatchRating: builder.mutation({
      query: (id) => ({ url: `/ratings/apply/${id}`, method: "POST" }),
      invalidatesTags: (r, e, id) => [
        { type: "Match", id },
        { type: "MatchRating", id },
      ],
    }),
    getAdminTournaments: builder.query({
      query: () => ({
        url: "/admin/tournaments?fields=_id,name,status,startDate,endDate&limit=200",
      }),
      transformResponse: (res) => res.items || res.tournaments || res || [],
    }),
    getMatchesByTournament: builder.query({
      query: (tournamentId) => ({ url: `/tournaments/${tournamentId}/matches` }),
      transformResponse: (res) => res.items || res.matches || res || [],
    }),
  }),
});

export const {
  useGetMatchAdminQuery,
  useGetMatchLogsQuery,
  useGetMatchRatingChangesQuery,
  useApplyMatchRatingMutation,
  useGetAdminTournamentsQuery,
  useGetMatchesByTournamentQuery,
} = matchesApiSlice;
