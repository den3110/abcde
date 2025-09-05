// RTK Query endpoints cho progression (advance teams giữa các stage)
import { apiSlice } from "./apiSlice";

export const progressionApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/brackets/:bid/advancement/sources
    listSourcesForTarget: builder.query({
      query: (bracketId) => ({
        url: `/progression/brackets/${bracketId}/advancement/sources`,
        method: "GET",
      }),
      providesTags: (_res, _err, bid) => [{ type: "Brackets", id: bid }],
    }),

    // POST /api/brackets/:targetId/advancement/preview
    previewAdvancement: builder.mutation({
      query: ({ targetId, body }) => ({
        url: `/progression/brackets/${targetId}/advancement/preview`,
        method: "POST",
        body,
      }),
    }),

    // POST /api/brackets/:targetId/advancement/commit
    commitAdvancement: builder.mutation({
      query: ({ targetId, body }) => ({
        url: `/progression/brackets/${targetId}/advancement/commit`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Matches", "Brackets"],
    }),

    // POST /api/brackets/:targetId/advancement/prefill-draw
    prefillAdvancement: builder.mutation({
      query: ({ targetId, body }) => ({
        url: `/progression/brackets/${targetId}/advancement/prefill-draw`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Brackets"], // thường sẽ mở draw session mới
    }),
    feedStageToNext: builder.mutation({
      query: ({ tournamentId, sourceStage, targetStage, body }) => ({
        url: `/admin/tournaments/${tournamentId}/stages/${sourceStage}/feed-to/${targetStage}`,
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useListSourcesForTargetQuery,
  usePreviewAdvancementMutation,
  useCommitAdvancementMutation,
  usePrefillAdvancementMutation,
  useFeedStageToNextMutation,
} = progressionApiSlice;
