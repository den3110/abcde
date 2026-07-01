import { apiSlice } from "./apiSlice";

const SUPPORT_URL = "/support/admin/tickets";

const cleanParams = (params = {}) =>
  Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== "") acc[key] = value;
    return acc;
  }, {});

export const supportAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminSupportTickets: builder.query({
      query: ({
        page = 1,
        limit = 50,
        status = "",
        keyword = "",
        category = "",
        priority = "",
        assigned = "",
        unread = "",
      } = {}) => ({
        url: SUPPORT_URL,
        params: cleanParams({
          page,
          limit,
          status,
          keyword,
          category,
          priority,
          assigned,
          unread,
        }),
      }),
      providesTags: (result) => [
        { type: "SupportTicket", id: "ADMIN" },
        ...(result?.items || []).map((ticket) => ({
          type: "SupportTicket",
          id: ticket._id,
        })),
      ],
      keepUnusedDataFor: 10,
    }),
    getAdminSupportTicketDetail: builder.query({
      query: (id) => `${SUPPORT_URL}/${id}`,
      providesTags: (result, error, id) => [{ type: "SupportTicket", id }],
      keepUnusedDataFor: 10,
    }),
    replyAdminSupportTicket: builder.mutation({
      query: ({ id, text, attachments = [] }) => ({
        url: `${SUPPORT_URL}/${id}/messages`,
        method: "POST",
        body: { text, attachments },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "SupportTicket", id },
        { type: "SupportTicket", id: "ADMIN" },
      ],
    }),
    updateAdminSupportTicketStatus: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `${SUPPORT_URL}/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "SupportTicket", id },
        { type: "SupportTicket", id: "ADMIN" },
      ],
    }),
    uploadAdminSupportImage: builder.mutation({
      query: ({ file, options = {} }) => {
        const formData = new FormData();
        formData.append("image", file);
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            formData.append(key, String(value));
          }
        });
        return {
          url: "/upload/support",
          method: "POST",
          body: formData,
        };
      },
    }),
  }),
});

export const {
  useGetAdminSupportTicketsQuery,
  useGetAdminSupportTicketDetailQuery,
  useReplyAdminSupportTicketMutation,
  useUpdateAdminSupportTicketStatusMutation,
  useUploadAdminSupportImageMutation,
} = supportAdminApiSlice;
