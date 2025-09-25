import axios from "axios";
import { apiSlice } from "./apiSlice"; // base API slice của bạn (thường dùng fetchBaseQuery)

export const filesApiSlice = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    /* ===== LIST ===== */
    listFiles: builder.query({
      query: ({ q = "", category = "", page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (category) params.set("category", category);
        params.set("page", page);
        params.set("limit", limit);
        // apiSlice thường đã cấu hình baseUrl = "/api"
        return `/files?${params.toString()}`;
      },
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map(({ _id }) => ({ type: "File", id: _id })),
              { type: "File", id: "PARTIAL-LIST" },
            ]
          : [{ type: "File", id: "PARTIAL-LIST" }],
    }),

    /* ===== DELETE ===== */
    deleteFile: builder.mutation({
      query: (id) => ({ url: `/files/${id}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [
        { type: "File", id },
        { type: "File", id: "PARTIAL-LIST" },
      ],
    }),

    /* ===== Legacy multi-upload (multipart/form-data) — optional ===== */
    uploadFiles: builder.mutation({
      query: ({ files, category }) => {
        const form = new FormData();
        (files || []).forEach((f) => form.append("files", f));
        if (category) form.append("category", category);
        return { url: `/files`, method: "POST", body: form };
      },
      invalidatesTags: [{ type: "File", id: "PARTIAL-LIST" }],
    }),

    /* =========================================================
     * Multipart (chunk) PRO — tự host
     * ======================================================= */

    // 1) INIT
    multipartInit: builder.mutation({
      query: ({ fileName, size, mime, category = "general", chunkSize }) => ({
        url: `/files/multipart/init`,
        method: "POST",
        body: { fileName, size, mime, category, chunkSize },
      }),
    }),

    // 2) STATUS (nếu cần resume)
    multipartStatus: builder.query({
      query: (uploadId) => ({ url: `/files/multipart/${uploadId}/status` }),
    }),

    // 3) UPLOAD PART (dùng queryFn + axios để có onUploadProgress)
    multipartUploadPart: builder.mutation({
      // args: { uploadId, partNo, blob, contentRange, checksum, signal, onUploadProgress }
      async queryFn(args) {
        const { uploadId, partNo, blob, contentRange, checksum, signal, onUploadProgress } =
          args || {};
        try {
          const res = await axios.put(
            process.env.REACT_APP_API_URL + `/files/multipart/${uploadId}/${partNo}`,
            blob,
            {
              withCredentials: true,
              signal,
              headers: {
                "Content-Type": "application/octet-stream",
                ...(contentRange ? { "Content-Range": contentRange } : {}),
                ...(checksum ? { "X-Chunk-Checksum": checksum } : {}),
              },
              onUploadProgress,
            }
          );
          // 204 No Content -> coi như ok
          return { data: res.data ?? {} };
        } catch (err) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? { message: err.message },
            },
          };
        }
      },
    }),

    // 4) COMPLETE
    multipartComplete: builder.mutation({
      query: (uploadId) => ({
        url: `/files/multipart/${uploadId}/complete`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "File", id: "PARTIAL-LIST" }],
    }),

    // 5) CANCEL (nếu cần)
    multipartCancel: builder.mutation({
      query: (uploadId) => ({
        url: `/files/multipart/${uploadId}/cancel`,
        method: "POST",
      }),
    }),
  }),
});

export const {
  useListFilesQuery,
  useDeleteFileMutation,
  useUploadFilesMutation, // legacy

  // multipart
  useMultipartInitMutation,
  useLazyMultipartStatusQuery,
  useMultipartUploadPartMutation,
  useMultipartCompleteMutation,
  useMultipartCancelMutation,
} = filesApiSlice;
