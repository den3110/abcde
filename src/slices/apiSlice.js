// src/slices/apiSlice.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./authSlice";

/* ---------- 1. Base query gốc: thêm prepareHeaders ---------- */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: process.env.REACT_APP_API_URL, // .env
  credentials: "include", // gửi cookie
  prepareHeaders: (headers, { getState }) => {
    // Lấy token lưu trong Redux (được set sau khi login)
    const token = getState().auth.userInfo?.token;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

/* ---------- 2. Wrapper xử lý 401 tự logout ---------- */
const baseQuery = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);

  if (result.error?.status === 401) {
    api.dispatch(logout()); // xoá userInfo + token
    api.dispatch(apiSlice.util.resetApiState());
    // window.location.assign("/authentication/sign-in"); // tuỳ nhu cầu
  }

  return result;
};

/* ---------- 3. Khởi tạo apiSlice ---------- */
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User"], // thêm tag nếu cần
  endpoints: () => ({}), // các slice khác sẽ inject
});
