// slices/reconciliationApiSlice.js — Đối soát hoa hồng nền tảng
import { apiSlice } from "./apiSlice";

export const reconciliationApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReconciliation: builder.query({
      query: ({ from, to }) => ({ url: `/admin/venues/reconciliation?from=${from}&to=${to}` }),
      providesTags: ["Reconciliation"],
    }),
    setVenueCommission: builder.mutation({
      query: ({ id, commissionPercent }) => ({
        url: `/admin/venues/${id}/commission`,
        method: "PATCH",
        body: { commissionPercent },
      }),
      invalidatesTags: ["Reconciliation"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetReconciliationQuery, useSetVenueCommissionMutation } = reconciliationApiSlice;
