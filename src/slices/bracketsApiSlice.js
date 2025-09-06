import { apiSlice } from "./apiSlice";

export const bracketsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Bracket detail (cần groups[], slotPlan[])
    getOnlyBracket: builder.query({
      query: (bid) => `/brackets/${bid}`,
      providesTags: (res, err, bid) => [
        { type: "Bracket", id: bid },
        { type: "SlotPlan", id: bid },
      ],
    }),

    // Danh sách Registration thuộc BRACKET/Tournament (tuỳ server)
    // Mặc định: GET /brackets/:bid/registrations?status=Paid
    listBracketRegistrations: builder.query({
      query: (bid) => `/admin/brackets/${bid}/registrations?status=Paid`,
      providesTags: (res, err, bid) => [{ type: "Registrations", id: bid }],
    }),

    // Bulk pre-assign theo payload { assignments, ... }
    bulkAssignSlotPlan: builder.mutation({
      query: ({ bid, body }) => ({
        url: `/admin/brackets/${bid}/slot-plan/bulk-assign`,
        method: "POST",
        body,
      }),
      invalidatesTags: (res, err, { bid }) => [
        { type: "SlotPlan", id: bid },
        { type: "Bracket", id: bid },
      ],
    }),

    // Bắt đầu draw mode=group (server sẽ tự ghim slotPlan đã lock)
    startGroupDraw: builder.mutation({
      query: ({ bid, body }) => ({
        url: `/draw/${bid}/start`,
        method: "POST",
        body: { mode: "group", ...body },
      }),
      invalidatesTags: (res, err, { bid }) => [{ type: "Draw", id: bid }],
    }),

    // Trạng thái draw gần nhất
    getDrawStatus: builder.query({
      query: (bid) => `/draw/brackets/${bid}/draw/status`,
      providesTags: (res, err, bid) => [{ type: "Draw", id: bid }],
    }),

    // (tuỳ chọn) Sinh trận round-robin tự động sau khi commit draw
    generateGroupMatches: builder.mutation({
      query: ({ bid, body }) => ({
        url: `/draw/brackets/${bid}/groups/generate-matches`,
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetOnlyBracketQuery,
  useListBracketRegistrationsQuery,
  useBulkAssignSlotPlanMutation,
  useStartGroupDrawMutation,
  useGetDrawStatusQuery,
  useGenerateGroupMatchesMutation,
} = bracketsApiSlice;
