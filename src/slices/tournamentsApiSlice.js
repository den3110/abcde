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
      query: ({ id, ...body }) => ({
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
} = tournamentsApiSlice;
