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
  }),
});

export const { useGetObserverOverviewQuery } = observerAdminApiSlice;
