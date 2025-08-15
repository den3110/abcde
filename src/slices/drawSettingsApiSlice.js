import { apiSlice } from "./apiSlice";

export const drawSettingsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDrawSettingsSchema: builder.query({
      query: () => `/d/draw/settings/schema`,
      providesTags: ["DrawSettingsSchema"],
    }),

    // Global
    getGlobalDrawSettings: builder.query({
      query: () => `/d/draw/settings`,
      providesTags: ["DrawSettings"],
    }),
    updateGlobalDrawSettings: builder.mutation({
      query: (body) => ({
        url: `/d/draw/settings`,
        method: "PUT",
        body, // { drawSettings: {...} }
      }),
      invalidatesTags: ["DrawSettings"],
    }),

    // Tournament scope
    getTournamentDrawSettings: builder.query({
      query: (tournamentId) => `/d/tournaments/${tournamentId}/draw/settings`,
      providesTags: (r, e, id) => [{ type: "DrawSettingsTournament", id }],
    }),
    updateTournamentDrawSettings: builder.mutation({
      query: ({ tournamentId, drawSettings }) => ({
        url: `/d/tournaments/${tournamentId}/draw/settings`,
        method: "PUT",
        body: { drawSettings },
      }),
      invalidatesTags: (r, e, arg) => [{ type: "DrawSettingsTournament", id: arg.tournamentId }],
    }),

    // Bracket scope
    getBracketDrawSettings: builder.query({
      query: (bracketId) => `/d/brackets/${bracketId}/draw/settings`,
      providesTags: (r, e, id) => [{ type: "DrawSettingsBracket", id }],
    }),
    updateBracketDrawSettings: builder.mutation({
      query: ({ bracketId, drawSettings }) => ({
        url: `/d/brackets/${bracketId}/draw/settings`,
        method: "PUT",
        body: { drawSettings },
      }),
      invalidatesTags: (r, e, arg) => [{ type: "DrawSettingsBracket", id: arg.bracketId }],
    }),

    // Effective + Preview
    getEffectiveDrawSettings: builder.query({
      query: ({ tournamentId, bracketId } = {}) => {
        const p = new URLSearchParams();
        if (tournamentId) p.set("tournamentId", tournamentId);
        if (bracketId) p.set("bracketId", bracketId);
        const qs = p.toString();
        return `/d/draw/settings/effective${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["DrawSettingsEffective"],
      // tránh cache đè giữa các tổ hợp scope
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}:${JSON.stringify(queryArgs || {})}`,
    }),
    previewDrawPlan: builder.mutation({
      query: ({ tournamentId, bracketId, override, groupSize, groupCount }) => ({
        url: `/d/draw/settings/preview`,
        method: "POST",
        body: { tournamentId, bracketId, override, groupSize, groupCount },
      }),
    }),
  }),
});

export const {
  useGetDrawSettingsSchemaQuery,
  useGetGlobalDrawSettingsQuery,
  useUpdateGlobalDrawSettingsMutation,
  useGetTournamentDrawSettingsQuery,
  useUpdateTournamentDrawSettingsMutation,
  useGetBracketDrawSettingsQuery,
  useUpdateBracketDrawSettingsMutation,
  useGetEffectiveDrawSettingsQuery,
  usePreviewDrawPlanMutation,
} = drawSettingsApiSlice;
