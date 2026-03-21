// JS version
import { apiSlice } from "./apiSlice";

export const adminNotifyApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    globalBroadcast: builder.mutation({
      // body: { title, body, url?, platform?, minVersion?, maxVersion?, badge?, ttl? }
      query: (body) => ({
        url: "/events/global/broadcast",
        method: "POST",
        body,
      }),
      invalidatesTags: ["PushDispatch"],
    }),
    // 👇 thêm endpoint này
    userBroadcast: builder.mutation({
      query: (payload) => ({
        url: "/events/user/broadcast", // backend bạn đọc req.body.userId
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["PushDispatch"],
    }),
  }),
});

export const { useGlobalBroadcastMutation, useUserBroadcastMutation } = adminNotifyApi;
