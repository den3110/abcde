// slices/configApiSlice.js
import { apiSlice } from "./apiSlice";

export const configApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getConfigs: builder.query({
      query: (params) => ({ url: "/admin/config", params }),
      providesTags: (result) => {
        const base = [{ type: "Configs", id: "LIST" }];
        if (!result?.items?.length) return base;
        return [...base, ...result.items.map((x) => ({ type: "Config", id: x.key }))];
      },
    }),

    getConfig: builder.query({
      query: (key) => `/admin/config/${encodeURIComponent(key)}`,
      providesTags: (_, __, key) => [{ type: "Config", id: key }],
    }),

    upsertConfig: builder.mutation({
      query: (body) => ({ url: "/admin/config", method: "POST", body }),
      invalidatesTags: (_, __, arg) => [
        { type: "Configs", id: "LIST" },
        ...(arg?.key ? [{ type: "Config", id: arg.key }] : []),
      ],
    }),

    deleteConfig: builder.mutation({
      query: (key) => ({ url: `/admin/config/${encodeURIComponent(key)}`, method: "DELETE" }),
      invalidatesTags: (_, __, key) => [
        { type: "Configs", id: "LIST" },
        { type: "Config", id: key },
      ],
    }),

    // ⬇️ NEW: trigger FB resync
    triggerFbResync: builder.mutation({
      // mode: "now" | "schedule" (default mình sẽ gửi "now")
      query: (mode = "now") => ({
        url: "/admin/fb/resync",
        method: "POST",
        body: { mode },
      }),
    }),
    // 🆕 Revoke (ngắt kết nối)
    ytRevoke: builder.mutation({
      // nếu bạn map route là GET thì để method: 'GET'
      query: () => ({ url: "/admin/youtube/revoke", method: "POST" }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConfigsQuery,
  useGetConfigQuery,
  useUpsertConfigMutation,
  useDeleteConfigMutation,
  useLazyGetConfigQuery,
  useTriggerFbResyncMutation, // ⬅️ export hook
  useYtRevokeMutation,
} = configApiSlice;
