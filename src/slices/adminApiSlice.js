import { apiSlice } from "./apiSlice";

export const adminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: ({ page = 1, keyword = "", role = "" }) =>
        `/admin/users?page=${page}&keyword=${keyword}&role=${role}`,
      providesTags: ["User"],
    }),
    updateUserRole: builder.mutation({
      query: ({ id, role }) => ({
        url: `/admin/users/${id}/role`,
        method: "PUT",
        body: { role },
      }),
      invalidatesTags: ["User"],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({ url: `/admin/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
    /** ✨ SỬA hồ sơ (name, phone, …) */
    updateUserInfo: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/users/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    /** ✨ DUYỆT hoặc TỪ CHỐI KYC */
    reviewKyc: builder.mutation({
      query: ({ id, action }) => ({
        url: `/admin/users/${id}/kyc`,
        method: "PUT",
        body: { action }, // "approve" | "reject"
      }),
      invalidatesTags: ["User"],
    }),
    updateRanking: builder.mutation({
      query: ({ id, single, double }) => ({
        url: `/admin/rankings/${id}`,
        method: "PUT",
        body: { single, double },
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
  useReviewKycMutation,
  useUpdateUserInfoMutation,
  useUpdateRankingMutation,
} = adminApiSlice;
