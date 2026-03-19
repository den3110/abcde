import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout } from "./authSlice";

function clearAllCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (!name) return;
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

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timeZone) headers.set("X-Timezone", timeZone);

      const offsetMinutes = new Date().getTimezoneOffset();
      headers.set("X-Timezone-Offset", String(offsetMinutes));

      const totalMinutes = Math.abs(offsetMinutes);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const sign = offsetMinutes <= 0 ? "+" : "-";
      const pad = (value) => String(value).padStart(2, "0");
      headers.set("X-Timezone-Gmt", `GMT${sign}${pad(hours)}:${pad(minutes)}`);
    } catch (error) {
      console.log("Cannot resolve timezone for headers", error);
    }

    return headers;
  },
});

const baseQuery = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);
  const status = result.error?.status;

  if (status === 401 || status === 403) {
    const hasSession = Boolean(api.getState()?.auth?.userInfo);
    if (hasSession) {
      localStorage.clear();
      clearAllCookies();
      api.dispatch(logout());
      window.dispatchEvent(new CustomEvent("app:unauthorized"));
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "User",
    "Registration",
    "LiveSessions",
    "LiveRecordingMonitor",
    "SystemSettings",
    "RecordingDriveStatus",
  ],
  endpoints: () => ({}),
});
