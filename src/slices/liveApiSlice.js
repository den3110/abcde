// =========================
// FILE: src/slices/liveApiSlice.js (thêm endpoint)
// =========================
// NOTE: Chèn đoạn dưới vào file slices/liveApiSlice.js hiện có của bạn
// hoặc tạo mới nếu chưa có. Đảm bảo đã có apiSlice cấu hình sẵn.

import { apiSlice } from "./apiSlice";

export const liveApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * GET /api/admin/live-sessions?status=live
     * Trả về mảng các phiên live với cấu trúc:
     * {
     *   id, status, startedAt, startedBy: {name,_id},
     *   match: { _id, code, tournament:{_id,name}, bracket:{name,stage,round}, pairA, pairB },
     *   outputs: [ { platform, targetName/pageName/channelName/account, publicUrl/url/viewUrl, ... } ]
     * }
     */
    adminListLiveSessions: builder.query({
      query: ({ status = "live" } = {}) => ({
        url: `/admin/live-sessions?status=${encodeURIComponent(status)}`,
        method: "GET",
      }),
      providesTags: (result) => [{ type: "LiveSessions", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const { useAdminListLiveSessionsQuery } = liveApiSlice;
