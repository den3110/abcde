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
    }),
  }),
});

export const { useGlobalBroadcastMutation } = adminNotifyApi;
