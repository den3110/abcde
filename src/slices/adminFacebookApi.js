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
  }),
  overrideExisting: true,
});

export const { useExchangeLongUserTokenMutation } = adminFacebookApi;
