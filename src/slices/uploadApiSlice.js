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
    uploadAvatar: builder.mutation({
      // file: File | Blob | FormData
      query: (file) => {
        const form =
          file instanceof FormData
            ? file
            : (() => {
                const fd = new FormData();
                fd.append("avatar", file);
                return fd;
              })();
        return {
          url: "/upload/avatar", // -> '/api/upload/avatar' theo baseUrl ở apiSlice
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
  useUploadAvatarMutation,
  useUploadImageMutation, // optional
} = uploadApiSlice;
