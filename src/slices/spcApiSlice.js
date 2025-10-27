// Yêu cầu: đã có apiSlice (createApi) cấu hình sẵn baseUrl + auth
import { apiSlice } from "./apiSlice";

export const spcApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSpcMeta: builder.query({
      query: () => ({ url: "/admin/spc/meta" }),
      providesTags: ["SpcMeta"],
    }),
    getSpcSample: builder.query({
      query: (limit = 20) => ({ url: "/admin/spc/sample", params: { limit } }),
      providesTags: ["SpcSample"],
    }),
    uploadSpc: builder.mutation({
      query: (formData) => ({ url: "/admin/spc/upload", method: "POST", body: formData }),
      invalidatesTags: ["SpcMeta", "SpcSample"],
    }),
  }),
});

export const { useGetSpcMetaQuery, useGetSpcSampleQuery, useUploadSpcMutation } = spcApiSlice;
