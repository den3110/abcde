// src/slices/uploadApiSlice.js
// Yêu cầu: đã có apiSlice gốc:
//   import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
//   export const apiSlice = createApi({ baseQuery: fetchBaseQuery({ baseUrl: '/api' }), tagTypes: [...], endpoints: () => ({}) })
import { apiSlice } from "./apiSlice";

// Chuẩn hoá URL trả về từ các backend khác nhau
const pickUrl = (res) =>
  res?.url ?? res?.secure_url ?? res?.path ?? res?.data?.url ?? res?.data?.path ?? null;

export const uploadApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Upload avatar/logo từ file máy người dùng
     * - Server nhận multipart field name: "avatar"
     * - KHÔNG set 'Content-Type' để browser tự gắn boundary
     * - Trả về { url, raw } (url đã chuẩn hoá)
     */
    uploadV2: builder.mutation({
      // arg: File | Blob | FormData | { file, format?, width?, height?, quality? }
      query: (arg) => {
        let form;
        let url = "/upload/sponsors"; // hoặc /upload/:id nếu bạn đổi sau

        const params = new URLSearchParams();

        // 1) Nếu đã là FormData => dùng luôn (tự chịu trách nhiệm field bên ngoài)
        if (arg instanceof FormData) {
          form = arg;
        }
        // 2) Nếu là File/Blob => behavior cũ, chỉ gửi mỗi file
        else if (arg instanceof File || arg instanceof Blob) {
          form = new FormData();
          form.append("image", arg); // field cho backend: single("image")
        }
        // 3) Nếu là object có options
        else {
          const { file, format, width, height, quality } = arg || {};
          form = new FormData();

          if (file) {
            form.append("image", file);
          }

          // 🔽 Mấy cái này chuyển sang query thay vì FormData
          if (format) params.set("format", String(format));
          if (width) params.set("width", String(width));
          if (height) params.set("height", String(height));
          if (quality) params.set("quality", String(quality));
        }

        const qs = params.toString();
        if (qs) {
          url += `?${qs}`;
        }

        return {
          url,
          method: "POST",
          body: form,
        };
      },
      transformResponse: (res) => ({ url: pickUrl(res), raw: res }),
    }),

    /**
     * (Tuỳ chọn) Upload ảnh chung, linh hoạt tên field/folder
     * Sử dụng khi bạn có endpoint khác: /upload/image
     */
    uploadImage: builder.mutation({
      // args: { file, field='file', folder, ...extras }
      query: ({ file, field = "file", folder, ...extras } = {}) => {
        const fd = new FormData();
        if (file) fd.append(field, file);
        if (folder) fd.append("folder", folder);
        Object.entries(extras || {}).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, v);
        });
        return {
          url: "/upload/image",
          method: "POST",
          body: fd,
        };
      },
      transformResponse: (res) => ({ url: pickUrl(res), raw: res }),
    }),
  }),
});

export const {
  useUploadV2Mutation,
  useUploadImageMutation, // optional
} = uploadApiSlice;
