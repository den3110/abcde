import { apiSlice } from "./apiSlice";

export const observerAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getObserverOverview: builder.query({
      query: ({
        source = "",
        deviceId = "",
        minutes = 60,
        onlineOnly = false,
        deviceLimit = 50,
        deviceEventLimit = 30,
        errorLimit = 20,
      } = {}) => {
        const params = new URLSearchParams();
        if (source) params.set("source", source);
        if (deviceId) params.set("deviceId", deviceId);
        params.set("minutes", String(minutes));
        params.set("onlineOnly", onlineOnly ? "true" : "false");
        params.set("deviceLimit", String(deviceLimit));
        params.set("deviceEventLimit", String(deviceEventLimit));
        params.set("errorLimit", String(errorLimit));

        return {
          url: `/admin/observer/overview?${params.toString()}`,
          method: "GET",
        };
      },
      keepUnusedDataFor: 10,
    }),
    getPrimaryLogs: builder.query({
      query: ({
        page = 1,
        limit = 100,
        source = "",
        category = "",
        type = "",
        level = "",
        method = "",
        routingMode = "",
        archivedFromObserver = "all",
        q = "",
        since = "",
        until = "",
      } = {}) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (source) params.set("source", source);
        if (category) params.set("category", category);
        if (type) params.set("type", type);
        if (level) params.set("level", level);
        if (method) params.set("method", method);
        if (routingMode) params.set("routingMode", routingMode);
        if (archivedFromObserver && archivedFromObserver !== "all") {
          params.set("archivedFromObserver", archivedFromObserver);
        }
        if (q) params.set("q", q);
        if (since) params.set("since", since);
        if (until) params.set("until", until);

        return {
          url: `/admin/logs/primary?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["PrimaryLogs"],
      keepUnusedDataFor: 10,
    }),
  }),
});

export const { useGetObserverOverviewQuery, useGetPrimaryLogsQuery } =
  observerAdminApiSlice;
