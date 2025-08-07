import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./authSlice";

// Helper to delete all cookies
function clearAllCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    // set the cookie to expire in the past
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: process.env.REACT_APP_API_URL,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.userInfo?.token;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// Wrap the baseQuery to handle auth errors
const baseQuery = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);

  const status = result.error?.status;
  if (status === 401 || status === 403) {
    // 1. Clear localStorage
    localStorage.clear();
    // 2. Clear all cookies
    clearAllCookies();
    // 3. Remove auth from Redux and reset RTKQ cache
    api.dispatch(logout());
    api.dispatch(apiSlice.util.resetApiState());
    // 4. Redirect to login
    window.location.assign("/authentication/sign-in");
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User", "Registration" /* etc */],
  endpoints: () => ({}),
});
