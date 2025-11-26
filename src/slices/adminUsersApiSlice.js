// slices/adminUsersApiSlice.js
import { apiSlice } from "./apiSlice"; // chỉnh đường dẫn nếu khác

/**
 * Admin create user (manual)
 * Payload gợi ý:
 * {
 *   name, nickname, phone, email,
 *   password, // chuỗi plain, server sẽ hash theo User.pre('save')
 *   role,           // "user" | "referee" | "admin"
 *   verified,       // "pending" | "verified"
 *   gender,         // "male" | "female" | "unspecified" | "other"
 *   province,       // string
 *   dob,            // ISO string hoặc yyyy-mm-dd
 *   avatar          // URL ảnh (nếu bạn upload trước qua useUploadAvatarMutation)
 * }
 *
 * Trả về: { user, created: true } (tuỳ backend)
 */
export const adminUsersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    adminCreateUser: builder.mutation({
      query: (body) => ({
        url: "/admin/users", // đổi nếu backend dùng path khác
        method: "POST",
        body,
      }),
      // Nhớ thêm 'User' trong tagTypes của apiSlice nếu muốn invalidate list
      invalidatesTags: (result, error) => (error ? [] : [{ type: "User", id: "LIST" }]),
    }),
    searchUsers: builder.query({
      query: ({ q, limit = 10 }) => ({
        url: "/users/search",
        params: { q, limit }, // fetchBaseQuery sẽ tự serialize
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useAdminCreateUserMutation, useLazySearchUsersQuery } = adminUsersApiSlice;
