// slices/courtOwnerAdminApiSlice.js — Duyệt yêu cầu làm chủ sân
import { apiSlice } from "./apiSlice";

export const courtOwnerAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listOwnerRequests: builder.query({
      query: ({ status = "", page = 1, limit = 30 } = {}) => {
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        p.set("page", String(page));
        p.set("limit", String(limit));
        return { url: `/admin/court-owner/requests?${p.toString()}` };
      },
      providesTags: ["CourtOwnerRequests"],
    }),
    approveOwnerRequest: builder.mutation({
      query: (id) => ({ url: `/admin/court-owner/requests/${id}/approve`, method: "PATCH" }),
      invalidatesTags: ["CourtOwnerRequests"],
    }),
    rejectOwnerRequest: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/court-owner/requests/${id}/reject`, method: "PATCH", body: { reason } }),
      invalidatesTags: ["CourtOwnerRequests"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListOwnerRequestsQuery,
  useApproveOwnerRequestMutation,
  useRejectOwnerRequestMutation,
} = courtOwnerAdminApiSlice;
