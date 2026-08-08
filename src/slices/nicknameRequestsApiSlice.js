// src/slices/nicknameRequestsApiSlice.js
import { apiSlice } from "./apiSlice";

export const nicknameRequestsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listNicknameRequests: builder.query({
      query: (params = {}) => ({
        url: "/admin/nickname-requests",
        params,
      }),
      providesTags: (result) => {
        const base = [{ type: "NicknameRequest", id: "LIST" }];
        if (!result?.items?.length) return base;
        return [
          ...base,
          ...result.items.map((r) => ({
            type: "NicknameRequest",
            id: r._id,
          })),
        ];
      },
    }),
    approveNicknameRequest: builder.mutation({
      query: (id) => ({
        url: `/admin/nickname-requests/${id}/approve`,
        method: "POST",
      }),
      invalidatesTags: (r, e, id) => [
        { type: "NicknameRequest", id },
        { type: "NicknameRequest", id: "LIST" },
      ],
    }),
    rejectNicknameRequest: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/admin/nickname-requests/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (r, e, { id }) => [
        { type: "NicknameRequest", id },
        { type: "NicknameRequest", id: "LIST" },
      ],
    }),
    resetNicknameCooldown: builder.mutation({
      query: (userId) => ({
        url: `/admin/users/${userId}/reset-nickname-cooldown`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
  }),
});

export const {
  useListNicknameRequestsQuery,
  useApproveNicknameRequestMutation,
  useRejectNicknameRequestMutation,
  useResetNicknameCooldownMutation,
} = nicknameRequestsApiSlice;
