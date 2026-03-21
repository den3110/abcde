import { apiSlice } from "./apiSlice";

export const pushDispatchApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPushDispatchSummary: builder.query({
      query: () => ({
        url: "/admin/push/summary",
      }),
      providesTags: ["PushDispatch"],
    }),
    getPushDispatches: builder.query({
      query: (params = {}) => ({
        url: "/admin/push/dispatches",
        params,
      }),
      providesTags: ["PushDispatch"],
    }),
    getPushDispatchById: builder.query({
      query: (id) => ({
        url: `/admin/push/dispatches/${id}`,
      }),
      providesTags: (result, error, id) => [{ type: "PushDispatch", id }],
    }),
  }),
});

export const {
  useGetPushDispatchSummaryQuery,
  useGetPushDispatchesQuery,
  useLazyGetPushDispatchByIdQuery,
} = pushDispatchApiSlice;
