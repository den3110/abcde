// src/slices/authSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  userInfo: JSON.parse(localStorage.getItem("userInfo") || "null"),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, { payload }) => {
      state.userInfo = payload; // ① lưu cùng tên
      localStorage.setItem("userInfo", JSON.stringify(payload));
    },
    // alias để chỗ khác dùng setCredentials vẫn chạy
    setCredentials: (state, { payload }) => {
      state.userInfo = payload;
      localStorage.setItem("userInfo", JSON.stringify(payload));
    },
    logout: (state) => {
      state.userInfo = null;
      localStorage.clear();
      sessionStorage.clear();
    },
  },
});

export const { setUser, setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
