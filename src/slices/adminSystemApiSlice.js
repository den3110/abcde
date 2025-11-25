// src/slices/adminSystemApiSlice.js
import { apiSlice } from "./apiSlice"; // chỉnh path cho đúng dự án của bạn

export const adminSystemApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSystemSummary: builder.query({
      query: () => "/admin/system/summary",
    }),

    getDiskUsage: builder.query({
      query: () => "/admin/system/disk",
    }),

    getTopProcesses: builder.query({
      query: ({ sortBy = "cpu", limit = 20 } = {}) =>
        `/admin/system/processes?sortBy=${sortBy}&limit=${limit}`,
    }),

    getServicesStatus: builder.query({
      query: () => "/admin/system/services",
    }),

    getNetworkSummary: builder.query({
      query: () => "/admin/system/network",
    }),

    getOpenPorts: builder.query({
      query: () => "/admin/system/ports",
    }),

    getLogTypes: builder.query({
      query: () => "/admin/system/logs/types",
    }),

    getLogTail: builder.query({
      query: ({ type, lines = 200 }) => ({
        url: "/admin/system/logs/tail",
        params: { type, lines },
      }),
    }),

    getSafeCommands: builder.query({
      query: () => "/admin/system/commands",
    }),

    execSafeCommand: builder.mutation({
      query: ({ cmdKey }) => ({
        url: "/admin/system/exec",
        method: "POST",
        body: { cmdKey },
      }),
    }),
  }),
});

export const {
  useGetSystemSummaryQuery,
  useGetDiskUsageQuery,
  useGetTopProcessesQuery,
  useGetServicesStatusQuery,
  useGetNetworkSummaryQuery,
  useGetOpenPortsQuery,
  useGetLogTypesQuery,
  useGetLogTailQuery,
  useGetSafeCommandsQuery,
  useExecSafeCommandMutation,
} = adminSystemApiSlice;
