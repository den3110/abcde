import { createSlice } from "@reduxjs/toolkit";

/* UI-state riêng cho bảng Tournament */
const slice = createSlice({
  name: "adminTournamentUi",
  initialState: {
    page: 0, // zero-based
    limit: 10,
    keyword: "",
    status: "",
    sort: "-createdAt",
  },
  reducers: {
    setTPage: (s, { payload }) => {
      s.page = payload;
    },
    setTLimit: (s, { payload }) => {
      s.limit = payload;
      s.page = 0;
    },
    setTKeyword: (s, { payload }) => {
      s.keyword = payload.trim();
      s.page = 0;
    },
    setTStatus: (s, { payload }) => {
      s.status = payload;
      s.page = 0;
    },
    setTSort: (s, { payload }) => {
      s.sort = payload;
      s.page = 0;
    },
    resetTUI: () => ({
      page: 0,
      limit: 10,
      keyword: "",
      status: "",
      sort: "-createdAt",
    }),
  },
});

export const { setTPage, setTLimit, setTKeyword, setTStatus, setTSort, resetTUI } = slice.actions;

export default slice.reducer;
