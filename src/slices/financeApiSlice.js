// src/slices/financeApiSlice.js — Thu/chi giải đấu (lợi nhuận)
import { apiSlice } from "./apiSlice";

const qs = (o = {}) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const financeApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceEntries: builder.query({
      query: (params = {}) => ({ url: `/admin/finance${qs(params)}` }),
      providesTags: ["Finance"],
    }),
    getFinanceSummary: builder.query({
      query: (params = {}) => ({ url: `/admin/finance/summary${qs(params)}` }),
      providesTags: ["Finance"],
    }),
    createFinanceEntry: builder.mutation({
      query: (body) => ({ url: `/admin/finance`, method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    updateFinanceEntry: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/finance/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Finance"],
    }),
    deleteFinanceEntry: builder.mutation({
      query: (id) => ({ url: `/admin/finance/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFinanceEntriesQuery,
  useGetFinanceSummaryQuery,
  useCreateFinanceEntryMutation,
  useUpdateFinanceEntryMutation,
  useDeleteFinanceEntryMutation,
} = financeApiSlice;
