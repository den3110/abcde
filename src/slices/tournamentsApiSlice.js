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
      query: (id) => `/admin/tournaments/${id}/registrations`,
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
    // slices/tournamentsApiSlice.js
    listAllMatchesTournament: builder.query({
      // params: { tournament?, bracket?, status? }
      query: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return `/admin/matches/all${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result = []) =>
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
    resetMatchChain: builder.mutation({
      query: ({ matchId }) => ({
        url: `/admin/matches/${matchId}/reset-chain`,
        method: "POST",
      }),
    }),
    // 1) danh sách trận được phân cho referee hiện tại
    listRefereeMatches: builder.query({
      query: ({ page = 1, pageSize = 10 } = {}) => ({
        url: `/referee/matches/assigned-to-me`,
        params: { page, pageSize },
      }),
      // (khuyến nghị) Chuẩn hoá response -> luôn có shape phân trang
      transformResponse: (res) => {
        if (Array.isArray(res)) {
          return { items: res, page: 1, pageSize: res.length, total: res.length, totalPages: 1 };
        }
        return res;
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}-${queryArgs?.page || 1}-${queryArgs?.pageSize || 10}`,
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((m) => ({ type: "Match", id: m._id })),
              { type: "Match", id: "ASSIGNED_LIST" },
            ]
          : [{ type: "Match", id: "ASSIGNED_LIST" }],
    }),

    // 3) referee cộng/trừ điểm (delta: +1|-1)
    refereeIncPoint: builder.mutation({
      query: ({ matchId, side, delta }) => ({
        url: `/referee/matches/${matchId}/score`,
        method: "PATCH",
        body: { op: "inc", side, delta },
      }),

      // ✅ Optimistic update chi tiết trận
      async onQueryStarted({ matchId, side, delta }, { dispatch, queryFulfilled }) {
        const s = (side || "A").toUpperCase(); // chuẩn hoá
        const patch = dispatch(
          tournamentsApiSlice.util.updateQueryData("getMatch", matchId, (draft) => {
            if (!draft.gameScores || !draft.gameScores.length) {
              draft.gameScores = [{ a: 0, b: 0 }];
            }
            const i = Math.max(0, draft.gameScores.length - 1);
            if (s === "A") {
              const next = (draft.gameScores[i].a || 0) + delta;
              draft.gameScores[i].a = Math.max(0, next); // tránh âm
            } else {
              const next = (draft.gameScores[i].b || 0) + delta;
              draft.gameScores[i].b = Math.max(0, next);
            }
          })
        );
        try {
          await queryFulfilled; // giữ patch nếu OK
        } catch {
          patch.undo(); // rollback nếu lỗi
        }
      },

      // ✅ Refetch lại getMatch(matchId) để đồng bộ với server
      invalidatesTags: (_res, _err, { matchId }) => [{ type: "Match", id: matchId }],
    }),

    // (tuỳ chọn) set điểm tuyệt đối cho ván hiện tại
    refereeSetGameScore: builder.mutation({
      query: ({ matchId, gameIndex, a, b }) => ({
        url: `/referee/matches/${matchId}/score`,
        method: "PATCH",
        body: { op: "setGame", gameIndex, a, b },
      }),
      async onQueryStarted({ matchId, gameIndex, a, b }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          tournamentsApiSlice.util.updateQueryData("getMatch", matchId, (draft) => {
            if (!draft.gameScores) draft.gameScores = [];
            draft.gameScores[gameIndex] = { a, b };
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    // 4) set status
    refereeSetStatus: builder.mutation({
      query: ({ matchId, status }) => ({
        url: `/referee/matches/${matchId}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, { matchId }) => [{ type: "Match", id: matchId }],
    }),

    // 5) set winner (A|B|"")
    refereeSetWinner: builder.mutation({
      query: ({ matchId, winner }) => ({
        url: `/referee/matches/${matchId}/winner`,
        method: "PATCH",
        body: { winner },
      }),
      invalidatesTags: (_r, _e, { matchId }) => [{ type: "Match", id: matchId }],
    }),
    listTournamentManagers: builder.query({
      query: (tournamentId) => `/tournaments/${tournamentId}/managers`,
      providesTags: (res, err, id) => [{ type: "TManager", id }],
    }),
    addTournamentManager: builder.mutation({
      query: ({ tournamentId, userId }) => ({
        url: `/tournaments/${tournamentId}/managers`,
        method: "POST",
        body: { userId },
      }),
      invalidatesTags: (res, err, { tournamentId }) => [{ type: "TManager", id: tournamentId }],
    }),
    removeTournamentManager: builder.mutation({
      query: ({ tournamentId, userId }) => ({
        url: `/tournaments/${tournamentId}/managers/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (res, err, { tournamentId }) => [{ type: "TManager", id: tournamentId }],
    }),
    // GET /api/tournaments?sportType=&groupId=&status=&q=
    getTournaments: builder.query({
      query: ({ sportType, groupId, status, q } = {}) => {
        const params = new URLSearchParams();
        if (sportType !== undefined && sportType !== null && sportType !== "") {
          params.set("sportType", sportType);
        }
        if (groupId !== undefined && groupId !== null && groupId !== "") {
          params.set("groupId", groupId);
        }
        if (status) params.set("status", status);
        if (q) params.set("q", q);

        const qs = params.toString();
        return `/admin/tournaments${qs ? `?${qs}` : ""}`;
      },
      transformResponse: (res) => {
        // chấp mọi kiểu trả về phổ biến: [], {tournaments:[]}, {list:[]}
        if (Array.isArray(res)) return { tournaments: res };
        if (res?.tournaments && Array.isArray(res.tournaments)) {
          return { tournaments: res.tournaments, total: res.total };
        }
        if (res?.list && Array.isArray(res.list)) {
          return { tournaments: res.list, total: res.total };
        }
        return { tournaments: [] };
      },
      providesTags: (result) =>
        result?.tournaments
          ? [
              ...result.tournaments.map((t) => ({
                type: "Tournaments",
                id: t._id || t.id,
              })),
              { type: "Tournaments", id: "LIST" },
            ]
          : [{ type: "Tournaments", id: "LIST" }],
      // tránh cache đè khi đổi filter
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}:${JSON.stringify(queryArgs || {})}`,
    }),

    // GET /api/tournaments/:id/brackets
    listTournamentBrackets: builder.query({
      query: (tournamentId) => ({
        url: `/admin/tournaments/${tournamentId}/brackets`,
        method: "GET",
      }),
      transformResponse: (res) => {
        if (Array.isArray(res)) return res;
        if (res?.brackets && Array.isArray(res.brackets)) return res.brackets;
        if (res?.list && Array.isArray(res.list)) return res.list;
        return [];
      },
      providesTags: (result, error, tournamentId) => [
        { type: "Brackets", id: `T_${tournamentId}` },
        ...(Array.isArray(result)
          ? result.map((b) => ({ type: "Bracket", id: b._id || b.id }))
          : []),
      ],
      // key theo tournamentId để cache chuẩn
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}:${String(queryArgs || "")}`,
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
  useResetMatchChainMutation,
  useListRefereeMatchesQuery,
  useRefereeIncPointMutation,
  useRefereeSetGameScoreMutation,
  useRefereeSetStatusMutation,
  useRefereeSetWinnerMutation,
  useListTournamentManagersQuery,
  useAddTournamentManagerMutation,
  useRemoveTournamentManagerMutation,
  useGetTournamentsQuery,
  useListTournamentBracketsQuery,
  useListAllMatchesTournamentQuery,
} = tournamentsApiSlice;
