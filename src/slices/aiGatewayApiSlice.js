import { apiSlice } from "./apiSlice";

export const aiGatewayApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAiGatewayConfig: builder.query({
      query: () => ({ url: "/admin/ai-gateway" }),
      providesTags: ["AiGateway"],
    }),
    getAiGatewayLogs: builder.query({
      query: ({ limit = 120, afterId } = {}) => ({
        url: "/admin/ai-gateway/logs",
        params: {
          limit,
          ...(afterId ? { afterId } : {}),
        },
      }),
      providesTags: ["AiGatewayLogs"],
    }),
    updateAiGatewayConfig: builder.mutation({
      query: (body) => ({
        url: "/admin/ai-gateway",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["AiGateway"],
    }),
    listAiGatewayModels: builder.mutation({
      query: (body) => ({
        url: "/admin/ai-gateway/models",
        method: "POST",
        body,
      }),
    }),
    testAiGatewayEndpoint: builder.mutation({
      query: (body) => ({
        url: "/admin/ai-gateway/test",
        method: "POST",
        body,
      }),
    }),
    refreshAiGatewayEndpoints: builder.mutation({
      query: () => ({
        url: "/admin/ai-gateway/refresh",
        method: "POST",
      }),
      invalidatesTags: ["AiGateway"],
    }),
  }),
});

export const {
  useGetAiGatewayConfigQuery,
  useGetAiGatewayLogsQuery,
  useUpdateAiGatewayConfigMutation,
  useListAiGatewayModelsMutation,
  useTestAiGatewayEndpointMutation,
  useRefreshAiGatewayEndpointsMutation,
} = aiGatewayApiSlice;
