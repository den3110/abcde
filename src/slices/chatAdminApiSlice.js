// slices/chatAdminApiSlice.js — moderation nhắn tin (admin)
import { apiSlice } from "./apiSlice";

export const chatAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    adminListConversations: builder.query({
      query: ({ cursor, type, limit = 30 } = {}) => {
        const p = new URLSearchParams();
        if (cursor) p.set("cursor", String(cursor));
        if (type) p.set("type", type);
        if (limit) p.set("limit", String(limit));
        return {
          url: `/admin/chat/conversations?${p.toString()}`,
          method: "GET",
        };
      },
      providesTags: [{ type: "AdminChat", id: "LIST" }],
    }),
    adminListMessages: builder.query({
      query: ({ cid, cursor, limit = 50 } = {}) => {
        const p = new URLSearchParams();
        if (cursor) p.set("cursor", String(cursor));
        if (limit) p.set("limit", String(limit));
        return {
          url: `/admin/chat/conversations/${cid}/messages?${p.toString()}`,
          method: "GET",
        };
      },
    }),
    adminPatchConversation: builder.mutation({
      query: ({ cid, ...body }) => ({
        url: `/admin/chat/conversations/${cid}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "AdminChat", id: "LIST" }],
    }),
    adminDeleteMessage: builder.mutation({
      query: (mid) => ({
        url: `/admin/chat/messages/${mid}`,
        method: "DELETE",
      }),
    }),
  }),
});

export const {
  useAdminListConversationsQuery,
  useAdminListMessagesQuery,
  useAdminPatchConversationMutation,
  useAdminDeleteMessageMutation,
} = chatAdminApiSlice;
