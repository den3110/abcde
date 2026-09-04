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
    getCampaignRecipients: builder.query({
      query: ({ id, status = "", page = 1, limit = 50, q = "" }) => {
        const p = new URLSearchParams({ page, limit });
        if (status) p.set("status", status);
        if (q) p.set("q", q);
        return { url: `/admin/email-campaigns/${id}/recipients?${p.toString()}` };
      },
      providesTags: ["EmailRecipients"],
    }),

    // ---- Danh sách khách hàng ----
    getContactLists: builder.query({
      query: () => ({ url: `/admin/email-contact-lists` }),
      providesTags: ["EmailContactList"],
    }),
    getContactList: builder.query({
      query: (id) => ({ url: `/admin/email-contact-lists/${id}` }),
      providesTags: ["EmailContactList"],
    }),
    createContactList: builder.mutation({
      query: (body) => ({ url: `/admin/email-contact-lists`, method: "POST", body }),
      invalidatesTags: ["EmailContactList"],
    }),
    deleteContactList: builder.mutation({
      query: (id) => ({ url: `/admin/email-contact-lists/${id}`, method: "DELETE" }),
      invalidatesTags: ["EmailContactList"],
    }),
    addContacts: builder.mutation({
      query: ({ id, contacts }) => ({
        url: `/admin/email-contact-lists/${id}/contacts`,
        method: "POST",
        body: { contacts },
      }),
      invalidatesTags: ["EmailContactList", "EmailContacts"],
    }),
    getContacts: builder.query({
      query: ({ id, page = 1, limit = 50, q = "", status = "" }) => {
        const p = new URLSearchParams({ page, limit });
        if (q) p.set("q", q);
        if (status) p.set("status", status);
        return { url: `/admin/email-contact-lists/${id}/contacts?${p.toString()}` };
      },
      providesTags: ["EmailContacts"],
    }),
    deleteContact: builder.mutation({
      query: ({ id, contactId }) => ({
        url: `/admin/email-contact-lists/${id}/contacts/${contactId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["EmailContactList", "EmailContacts"],
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
  useGetCampaignRecipientsQuery,
  useGetContactListsQuery,
  useGetContactListQuery,
  useCreateContactListMutation,
  useDeleteContactListMutation,
  useAddContactsMutation,
  useGetContactsQuery,
  useDeleteContactMutation,
} = emailCampaignApiSlice;
