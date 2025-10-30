// slices/bracketsApiSlice.js
import { apiSlice } from "./apiSlice";

export const bracketsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // lấy 1 bracket để biết nó là group hay po
    getOnlyBracket: builder.query({
      query: (bid) => `/brackets/${bid}`,
      providesTags: (res, err, bid) => [
        { type: "Bracket", id: bid },
        { type: "SlotPlan", id: bid },
        { type: "PoPlan", id: bid },
      ],
    }),

    // đọc trạng thái draw hiện tại (để lấy reveals nếu BE có trả)
    getDrawStatus: builder.query({
      query: (bid) => `/draw/brackets/${bid}/draw/status`,
      providesTags: (res, err, bid) => [{ type: "Draw", id: bid }],
    }),

    // ========== GROUP ==========
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

    startGroupDraw: builder.mutation({
      query: ({ bid, body }) => ({
        url: `/draw/${bid}/start`,
        method: "POST",
        body: { mode: "group", ...body },
      }),
      invalidatesTags: (res, err, { bid }) => [{ type: "Draw", id: bid }],
    }),

    // ========== PO / KNOCKOUT ==========
    // cơ cấu PO theo BRACKET (chuẩn ý bạn: cơ cấu 1 lần, mọi phiên draw đều ăn)
    bulkAssignPoPlan: builder.mutation({
      query: ({ bid, body }) => ({
        url: `/admin/brackets/${bid}/po-plan/bulk-assign`,
        method: "POST",
        body,
      }),
      invalidatesTags: (res, err, { bid }) => [
        { type: "PoPlan", id: bid },
        { type: "Bracket", id: bid },
        { type: "Draw", id: bid },
      ],
    }),

    // start PO cho bracket này
    startPoDraw: builder.mutation({
      query: ({ bid, body }) => ({
        url: `/draw/${bid}/start`,
        method: "POST",
        body: { mode: "po", ...body },
      }),
      invalidatesTags: (res, err, { bid }) => [{ type: "Draw", id: bid }],
    }),

    // optional
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
  useGetDrawStatusQuery,
  useBulkAssignSlotPlanMutation,
  useBulkAssignPoPlanMutation, // 👈 FE cơ cấu PO gọi cái này
  useStartGroupDrawMutation,
  useStartPoDrawMutation,
  useGenerateGroupMatchesMutation,
} = bracketsApiSlice;
