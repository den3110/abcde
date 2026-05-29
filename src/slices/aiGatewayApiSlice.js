import { apiSlice } from "./apiSlice";

export const aiGatewayApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAiGatewayConfig: builder.query({
      query: () => ({ url: "/admin/ai-gateway" }),
      providesTags: ["AiGateway"],
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
  }),
});

export const {
  useGetAiGatewayConfigQuery,
  useUpdateAiGatewayConfigMutation,
  useListAiGatewayModelsMutation,
  useTestAiGatewayEndpointMutation,
} = aiGatewayApiSlice;
