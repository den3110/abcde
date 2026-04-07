import { apiSlice } from "./apiSlice";

export const azureAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAzureVmStatuses: builder.query({
      query: () => "/admin/azure/status",
      providesTags: ["AzureVM"],
    }),
    getAzureBilling: builder.query({
      query: () => "/admin/azure/billing",
      providesTags: ["AzureBilling"],
    }),
    toggleAzureVm: builder.mutation({
      query: ({ accountId, action }) => ({
        url: "/admin/azure/vm/toggle",
        method: "POST",
        body: { accountId, action },
      }),
      invalidatesTags: ["AzureVM"],
    }),
  }),
});

export const {
  useGetAzureVmStatusesQuery,
  useGetAzureBillingQuery,
  useToggleAzureVmMutation,
} = azureAdminApiSlice;
