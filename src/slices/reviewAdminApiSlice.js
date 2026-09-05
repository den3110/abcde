// slices/reviewAdminApiSlice.js — Admin kiểm duyệt đánh giá giải/sân
import { apiSlice } from "./apiSlice";

export const reviewAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    adminListReviews: builder.query({
      query: ({ targetType, hidden, page = 1, limit = 30 } = {}) => {
        const p = new URLSearchParams();
        if (targetType) p.set("targetType", targetType);
        if (hidden !== undefined && hidden !== "") p.set("hidden", String(hidden));
        p.set("page", String(page));
        p.set("limit", String(limit));
        return { url: `/reviews/admin/list?${p.toString()}` };
      },
      providesTags: ["AdminReviews"],
    }),
    adminSetReviewHidden: builder.mutation({
      query: ({ id, hidden }) => ({
        url: `/reviews/admin/${id}/hidden`,
        method: "PATCH",
        body: { hidden },
      }),
      invalidatesTags: ["AdminReviews"],
    }),
  }),
  overrideExisting: false,
});

export const { useAdminListReviewsQuery, useAdminSetReviewHiddenMutation } =
  reviewAdminApiSlice;
