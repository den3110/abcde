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
    // ✅ Auth token
    const token = getState().auth.userInfo?.token;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    // ✅ Timezone headers
    try {
      // Ví dụ: "Asia/Ho_Chi_Minh"
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        headers.set("X-Timezone", tz);
      }

      // Offset phút so với UTC (VN: -420)
      const offsetMinutes = new Date().getTimezoneOffset();
      headers.set("X-Timezone-Offset", String(offsetMinutes));

      // Format GMT±HH:MM (ví dụ: GMT+07:00)
      const absTotalMinutes = Math.abs(offsetMinutes);
      const absHours = Math.floor(absTotalMinutes / 60);
      const absMinutes = absTotalMinutes % 60;
      const pad = (n) => String(n).padStart(2, "0");

      // getTimezoneOffset() là "UTC - local", nên GMT sign ngược lại
      const sign = offsetMinutes <= 0 ? "+" : "-";
      const gmt = `GMT${sign}${pad(absHours)}:${pad(absMinutes)}`;
      headers.set("X-Timezone-Gmt", gmt);
    } catch (e) {
      console.log("Cannot resolve timezone for headers", e);
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
