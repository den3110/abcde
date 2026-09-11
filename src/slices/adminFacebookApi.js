import { apiSlice } from "./apiSlice";

export const adminFacebookApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    exchangeLongUserToken: builder.mutation({
      // Nhận: string "shortToken" hoặc object { shortToken, appId?, appSecret? }
      query: (arg) => {
        let body = {};
        if (typeof arg === "string") {
          body.shortToken = arg;
        } else if (arg && typeof arg === "object") {
          const { shortToken, appId, appSecret } = arg;
          body.shortToken = shortToken;
          if (appId) body.appId = appId;
          if (appSecret) body.appSecret = appSecret;
        }
        return {
          url: "/admin/fb/long-user-token/exchange",
          method: "POST",
          body,
        };
      },
    }),
    // Quản lý FB_BOOT_LONG_USER_TOKEN
    inspectBootTokens: builder.query({
      query: () => ({ url: "/admin/fb/boot-tokens" }),
      providesTags: ["FbBootTokens"],
    }),
    addBootToken: builder.mutation({
      // arg: { token } hoặc { shortToken, appId?, appSecret? }
      query: (body) => ({ url: "/admin/fb/boot-tokens", method: "POST", body }),
      invalidatesTags: ["FbBootTokens"],
    }),
    deleteBootToken: builder.mutation({
      query: (fingerprint) => ({
        url: `/admin/fb/boot-tokens/${fingerprint}`,
        method: "DELETE",
      }),
      invalidatesTags: ["FbBootTokens"],
    }),
  }),
  overrideExisting: true,
});

export const {
  useExchangeLongUserTokenMutation,
  useInspectBootTokensQuery,
  useAddBootTokenMutation,
  useDeleteBootTokenMutation,
} = adminFacebookApi;
