import { apiSlice } from "./apiSlice";

export const venueAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listVenuesAdmin: builder.query({
      query: ({ page = 1, limit = 20, keyword = "", province = "", status = "" } = {}) => {
        const p = new URLSearchParams();
        p.set("page", String(page));
        p.set("limit", String(limit));
        if (keyword) p.set("keyword", keyword);
        if (province) p.set("province", province);
        if (status) p.set("status", status);
        return `/admin/venues?${p.toString()}`;
      },
      providesTags: [{ type: "VenueAdmin", id: "LIST" }],
      keepUnusedDataFor: 30,
    }),
    getVenueAdmin: builder.query({
      query: (id) => `/admin/venues/${id}`,
      providesTags: (res, err, id) => [{ type: "VenueAdmin", id }],
    }),
    setVenueStatus: builder.mutation({
      query: ({ id, status, isActive }) => ({
        url: `/admin/venues/${id}/status`,
        method: "PATCH",
        body: { status, isActive },
      }),
      invalidatesTags: (res, err, { id }) => [
        { type: "VenueAdmin", id },
        { type: "VenueAdmin", id: "LIST" },
      ],
    }),
    listBookingsAdmin: builder.query({
      query: ({ page = 1, limit = 20, status = "", payment = "", venueId = "", from = "", to = "" } = {}) => {
        const p = new URLSearchParams();
        p.set("page", String(page));
        p.set("limit", String(limit));
        if (status) p.set("status", status);
        if (payment) p.set("payment", payment);
        if (venueId) p.set("venueId", venueId);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        return `/admin/bookings?${p.toString()}`;
      },
      providesTags: [{ type: "BookingAdmin", id: "LIST" }],
      keepUnusedDataFor: 15,
    }),
  }),
  overrideExisting: false,
});

export const {
  useListVenuesAdminQuery,
  useGetVenueAdminQuery,
  useSetVenueStatusMutation,
  useListBookingsAdminQuery,
} = venueAdminApiSlice;
