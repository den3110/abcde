import { apiSlice } from "./apiSlice";

/* ------------- helpers ------------- */
const buildQuery = (base, params) =>
  base +
  Object.entries(params)
    .filter(([, v]) => v !== "" && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export const tournamentsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /* ---------------- USER ---------------- */
    getTournament: builder.query({
      query: (id) => `/tournaments/${id}`,
      providesTags: (r, e, id) => [{ type: "Tournament", id }],
    }),
    getRegistrations: builder.query({
      query: (id) => `/tournaments/${id}/registrations`,
      providesTags: (r, e, id) => [{ type: "Registration", id }],
    }),

    // 👉 New: register a pair of players
    createRegistration: builder.mutation({
      query: ({ tourId, message, player1Key, player2Key }) => ({
        url: `/tournaments/${tourId}/registrations`,
        method: "POST",
        body: { message, player1Key, player2Key },
      }),
      invalidatesTags: (res, err, { tourId }) => [{ type: "Registration", id: tourId }],
    }),

    // 👉 New: approve or undo payment (admin route)
    updatePayment: builder.mutation({
      query: ({ regId, status }) => ({
        url: `/admin/tournaments/registrations/${regId}/payment`,
        method: "PUT",
        body: { status },
      }),
      invalidatesTags: (res) => [
        // the list query provides tag with tournament-id
        { type: "Registration", id: res.tournament.toString() },
      ],
    }),

    // 👉 New: check-in a registration (admin route)
    checkinRegistration: builder.mutation({
      query: ({ regId }) => ({
        url: `/admin/tournaments/registrations/${regId}/checkin`,
        method: "PUT",
      }),
      invalidatesTags: (res, err, { regId }) => [{ type: "Registration", id: regId }],
    }),

    /* ---------------- ADMIN ---------------- */
    listTournaments: builder.query({
      query: ({ page = 1, limit = 10, keyword = "", status = "", sort = "-createdAt" }) =>
        buildQuery("/admin/tournaments?", { page, limit, keyword, status, sort }),
      providesTags: (r) =>
        r?.list
          ? [
              ...r.list.map(({ _id }) => ({ type: "Tournament", id: _id })),
              { type: "Tournament", id: "PARTIAL-LIST" },
            ]
          : [{ type: "Tournament", id: "PARTIAL-LIST" }],
    }),
    createTournament: builder.mutation({
      query: (body) => ({ url: "/admin/tournaments", method: "POST", body }),
      invalidatesTags: [{ type: "Tournament", id: "PARTIAL-LIST" }],
    }),
    updateTournament: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/tournaments/${id}`,
        method: "PUT",
        body,
      }),

      invalidatesTags: (res, err, arg) => [
        { type: "Tournament", id: arg.id },
        { type: "Tournament", id: "PARTIAL-LIST" },
      ],
    }),
    deleteTournament: builder.mutation({
      query: (id) => ({ url: `/admin/tournaments/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Tournament", id: "PARTIAL-LIST" }],
    }),
    // 👉 Delete registration (admin)
    deleteRegistration: builder.mutation({
      query: (regId) => ({
        url: `/admin/tournaments/registrations/${regId}`,
        method: "DELETE",
      }),
      invalidatesTags: (r) => [{ type: "Registration", id: r?.tournament?.toString() || "LIST" }],
    }),
    // Brackets
    listBrackets: builder.query({
      query: (tourId) => `/admin/tournaments/${tourId}/brackets`,
      providesTags: (r, e, tourId) =>
        r ? [{ type: "Bracket", id: tourId }] : [{ type: "Bracket", id: tourId }],
    }),
    createBracket: builder.mutation({
      query: ({ tourId, body }) => ({
        url: `/admin/tournaments/${tourId}/brackets`,
        method: "POST",
        body,
      }),
      invalidatesTags: (r, e, { tourId }) => [{ type: "Bracket", id: tourId }],
    }),

    // Matches
    listMatches: builder.query({
      query: (bracketId) => `/admin/brackets/${bracketId}/matches`,
      providesTags: (r, e, bracketId) =>
        r ? [{ type: "Match", id: bracketId }] : [{ type: "Match", id: bracketId }],
    }),
    createMatch: builder.mutation({
      query: ({ bracketId, body }) => ({
        url: `/admin/brackets/${bracketId}/matches`,
        method: "POST",
        body,
      }),
      invalidatesTags: (r, e, { bracketId }) => [{ type: "Match", id: bracketId }],
    }),
    deleteMatch: builder.mutation({
      query: (matchId) => ({
        url: `/admin/matches/${matchId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Match", id: "PARTIAL-LIST" }],
    }),
    updateMatchScore: builder.mutation({
      query: ({ matchId, body }) => ({
        url: `/matches/${matchId}/score`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (r) => (r ? [{ type: "Match", id: r.bracket.toString() }] : []),
    }),
    assignReferee: builder.mutation({
      query: ({ matchId, refereeId }) => ({
        url: `/admin/matches/${matchId}/referee`,
        method: "PATCH",
        body: { refereeId },
      }),
      invalidatesTags: (r) => (r ? [{ type: "Match", id: r.bracket.toString() }] : []),
    }),
    listAllMatches: builder.query({
      query: () => `/admin/matches/all`,
      providesTags: (result = [], error) =>
        result
          ? [...result.map((m) => ({ type: "Match", id: m._id })), { type: "Match", id: "LIST" }]
          : [{ type: "Match", id: "LIST" }],
    }),
    getMatch: builder.query({
      query: (matchId) => `/admin/matches/${matchId}`,
      providesTags: (r, e, id) => [{ type: "Match", id }],
    }),
    deleteBracket: builder.mutation({
      query: ({ tournamentId, bracketId }) => ({
        url: `/admin/tournaments/${tournamentId}/brackets/${bracketId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Bracket", id: "PARTIAL-LIST" }],
    }),
    // GET single bracket
    getBracket: builder.query({
      query: (bracketId) => `/admin/brackets/${bracketId}`,
      providesTags: (res, err, id) => [{ type: "Bracket", id }],
    }),
    updateBracket: builder.mutation({
      query: ({ tournamentId, bracketId, body }) => ({
        url: `/admin/tournaments/${tournamentId}/brackets/${bracketId}`,
        method: "PATCH",
        body,
      }),
    }),
    updateMatch: builder.mutation({
      query: ({ matchId, body }) => ({
        url: `/admin/matches/${matchId}`,
        method: "PATCH",
        body,
      }),
    }),
    uploadAvatar: builder.mutation({
      query: (file) => {
        const form = new FormData();
        form.append("avatar", file); // field name phía server
        return {
          url: "/upload/avatar", // baseUrl '/api' => thành /api/upload/avatar
          method: "POST",
          body: form,
        };
      },
    }),
    listMatchGroups: builder.query({
      query: (params) => ({ url: "/admin/matches/groups", params }),
    }),
    listMatchesPaged: builder.query({
      query: ({
        tournament,
        bracket,
        status,
        page = 1,
        limit = 10,
        sort = "round,order,-createdAt",
      }) => ({
        url: "/admin/matches",
        params: { tournament, bracket, status, page, limit, sort },
      }),
      // giữ data cũ khi đổi trang cho mượt
      keepUnusedDataFor: 30,
    }),
  }),
});

export const {
  /* user */
  useGetTournamentQuery,
  useGetRegistrationsQuery,
  useCreateRegistrationMutation,
  useUpdatePaymentMutation,
  useCheckinRegistrationMutation, // note the hook name
  /* admin */
  useListTournamentsQuery,
  useCreateTournamentMutation,
  useUpdateTournamentMutation,
  useDeleteTournamentMutation,
  useDeleteRegistrationMutation,
  useListBracketsQuery,
  useCreateBracketMutation,
  useListMatchesQuery,
  useCreateMatchMutation,
  useUpdateMatchScoreMutation,
  useAssignRefereeMutation,
  useListAllMatchesQuery,
  useGetMatchQuery,
  useDeleteMatchMutation,
  useDeleteBracketMutation,
  useGetBracketQuery,
  useUpdateBracketMutation,
  useUpdateMatchMutation,
  useUploadAvatarMutation,
  useListMatchGroupsQuery,
  useListMatchesPagedQuery,
} = tournamentsApiSlice;
