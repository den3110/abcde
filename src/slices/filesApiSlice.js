import { apiSlice } from "./apiSlice"; // your existing base api slice

export const filesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    uploadFiles: builder.mutation({
      query: ({ files, category }) => {
        const form = new FormData();
        (files || []).forEach((f) => form.append("files", f));
        if (category) form.append("category", category);
        return { url: "/files", method: "POST", body: form };
      },
    }),
    listFiles: builder.query({
      query: ({ q = "", category = "", page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (category) params.set("category", category);
        params.set("page", page);
        params.set("limit", limit);
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
    deleteFile: builder.mutation({
      query: (id) => ({ url: `/files/${id}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [
        { type: "File", id },
        { type: "File", id: "PARTIAL-LIST" },
      ],
    }),
  }),
});

export const { useUploadFilesMutation, useListFilesQuery, useDeleteFileMutation } = filesApiSlice;
