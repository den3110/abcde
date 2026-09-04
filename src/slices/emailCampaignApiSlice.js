// src/slices/emailCampaignApiSlice.js — Chiến dịch gửi email
import { apiSlice } from "./apiSlice";

export const emailCampaignApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEmailCampaigns: builder.query({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: `/admin/email-campaigns?page=${page}&limit=${limit}`,
      }),
      providesTags: ["EmailCampaign"],
    }),
    getEmailCampaign: builder.query({
      query: (id) => ({ url: `/admin/email-campaigns/${id}` }),
      providesTags: ["EmailCampaign"],
    }),
    estimateEmailAudience: builder.mutation({
      query: (body) => ({ url: `/admin/email-campaigns/estimate`, method: "POST", body }),
    }),
    createEmailCampaign: builder.mutation({
      query: (body) => ({ url: `/admin/email-campaigns`, method: "POST", body }),
      invalidatesTags: ["EmailCampaign"],
    }),
    updateEmailCampaign: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/email-campaigns/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["EmailCampaign"],
    }),
    sendTestEmail: builder.mutation({
      query: (body) => ({ url: `/admin/email-campaigns/test`, method: "POST", body }),
    }),
    sendEmailCampaign: builder.mutation({
      query: (id) => ({ url: `/admin/email-campaigns/${id}/send`, method: "POST" }),
      invalidatesTags: ["EmailCampaign"],
    }),
    cancelEmailCampaign: builder.mutation({
      query: (id) => ({ url: `/admin/email-campaigns/${id}/cancel`, method: "POST" }),
      invalidatesTags: ["EmailCampaign"],
    }),
    deleteEmailCampaign: builder.mutation({
      query: (id) => ({ url: `/admin/email-campaigns/${id}`, method: "DELETE" }),
      invalidatesTags: ["EmailCampaign"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmailCampaignsQuery,
  useGetEmailCampaignQuery,
  useEstimateEmailAudienceMutation,
  useCreateEmailCampaignMutation,
  useUpdateEmailCampaignMutation,
  useSendTestEmailMutation,
  useSendEmailCampaignMutation,
  useCancelEmailCampaignMutation,
  useDeleteEmailCampaignMutation,
} = emailCampaignApiSlice;
