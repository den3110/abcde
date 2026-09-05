// slices/eventLiveAdminApiSlice.js — Admin API cho event live chat & viewer tracking
import { apiSlice } from "./apiSlice";

export const eventLiveAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEventLiveComments: builder.query({
      query: ({ before, limit = 50 } = {}) => {
        const p = new URLSearchParams();
        if (limit) p.set("limit", String(limit));
        if (before) p.set("before", before);
        return { url: `/event-live/comments?${p.toString()}` };
      },
      providesTags: ["EventLiveComments"],
    }),
    deleteEventLiveComment: builder.mutation({
      query: (id) => ({
        url: `/event-live/comments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["EventLiveComments"],
    }),
    getEventLiveCommentStats: builder.query({
      query: (days = 7) => ({
        url: `/event-live/comments/stats?days=${days}`,
      }),
    }),
    getEventLiveViewers: builder.query({
      query: () => ({ url: `/event-live/viewers` }),
    }),
    getEventLiveViewerHistory: builder.query({
      query: ({ days = 7, page = 1, limit = 50 } = {}) => {
        const p = new URLSearchParams({ days, page, limit });
        return { url: `/event-live/viewers/history?${p.toString()}` };
      },
    }),
  }),
});

export const {
  useGetEventLiveCommentsQuery,
  useDeleteEventLiveCommentMutation,
  useGetEventLiveCommentStatsQuery,
  useGetEventLiveViewersQuery,
  useGetEventLiveViewerHistoryQuery,
} = eventLiveAdminApiSlice;
