// src/slices/mailboxApiSlice.js — Hộp thư (webmail) trong admin
import { apiSlice } from "./apiSlice";

const BASE = "/admin/mailbox";

export const mailboxApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ---- Tài khoản hộp thư ----
    getMailboxAccounts: builder.query({
      query: () => ({ url: `${BASE}/accounts` }),
      providesTags: ["MailboxAccount"],
    }),
    createMailboxAccount: builder.mutation({
      query: (body) => ({ url: `${BASE}/accounts`, method: "POST", body }),
      invalidatesTags: ["MailboxAccount"],
    }),
    updateMailboxAccount: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `${BASE}/accounts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["MailboxAccount"],
    }),
    deleteMailboxAccount: builder.mutation({
      query: (id) => ({ url: `${BASE}/accounts/${id}`, method: "DELETE" }),
      invalidatesTags: ["MailboxAccount"],
    }),
    testMailboxAccount: builder.mutation({
      query: ({ id = "new", ...body }) => ({
        url: `${BASE}/accounts/${id}/test`,
        method: "POST",
        body,
      }),
    }),

    // ---- Thao tác thư ----
    getMailboxFolders: builder.query({
      query: (id) => ({ url: `${BASE}/${id}/folders` }),
    }),
    getMailboxMessages: builder.query({
      query: ({ id, folder = "INBOX", page = 1, pageSize = 25, search = "" }) => ({
        url: `${BASE}/${id}/messages`,
        params: { folder, page, pageSize, search },
      }),
    }),
    getMailboxMessage: builder.query({
      query: ({ id, folder = "INBOX", uid, markSeen = 1 }) => ({
        url: `${BASE}/${id}/message`,
        params: { folder, uid, markSeen },
      }),
    }),
    markMailboxMessage: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `${BASE}/${id}/mark`,
        method: "POST",
        body,
      }),
    }),
    moveMailboxMessage: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `${BASE}/${id}/move`,
        method: "POST",
        body,
      }),
    }),
    deleteMailboxMessage: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `${BASE}/${id}/delete`,
        method: "POST",
        body,
      }),
    }),
    sendMailboxMessage: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `${BASE}/${id}/send`,
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetMailboxAccountsQuery,
  useCreateMailboxAccountMutation,
  useUpdateMailboxAccountMutation,
  useDeleteMailboxAccountMutation,
  useTestMailboxAccountMutation,
  useGetMailboxFoldersQuery,
  useGetMailboxMessagesQuery,
  useLazyGetMailboxMessageQuery,
  useMarkMailboxMessageMutation,
  useMoveMailboxMessageMutation,
  useDeleteMailboxMessageMutation,
  useSendMailboxMessageMutation,
} = mailboxApiSlice;
