import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  userInfo: localStorage.getItem("userInfo") ? JSON.parse(localStorage.getItem("userInfo")) : null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // payload = { user: {...}, token: "…" }
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      const info = { ...user, token };
      state.userInfo = info;
      // persist to localStorage
      localStorage.setItem("userInfo", JSON.stringify(info));
    },
    logout: (state) => {
      state.userInfo = null;
      // remove from localStorage
      localStorage.removeItem("userInfo");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
