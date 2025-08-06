import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./authSlice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: process.env.REACT_APP_API_URL, // khai trong .env
  credentials: "include", // gửi cookie jwt
});

const baseQuery = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);

  /* Auto-logout khi BE trả 401 */
  if (result.error?.status === 401) {
    api.dispatch(logout());
    api.dispatch(apiSlice.util.resetApiState());
    // window.location.assign("/login"); // điều hướng về trang login
  }
  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User"],
  endpoints: () => ({}), // các slice khác sẽ tiêm endpoint
});
