// src/slices/dashboardApiSlice.js
import { apiSlice } from "./apiSlice";

export const dashboardApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardMetrics: builder.query({
      query: ({ tz = "Asia/Ho_Chi_Minh" } = {}) => ({
        url: `/admin/dashboard/metrics?tz=${encodeURIComponent(tz)}`,
        method: "GET",
      }),
      providesTags: ["DASH_METRICS"],
    }),
    getDashboardSeries: builder.query({
      query: ({ tz = "Asia/Ho_Chi_Minh", days = 30 } = {}) => ({
        url: `/admin/dashboard/series?tz=${encodeURIComponent(tz)}&days=${days}`,
        method: "GET",
      }),
      providesTags: ["DASH_SERIES"],
    }),
  }),
});

export const { useGetDashboardMetricsQuery, useGetDashboardSeriesQuery } = dashboardApiSlice;
