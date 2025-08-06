import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "./slices/apiSlice";
import authReducer from "./slices/authSlice";
import adminUiReducer from "./slices/adminUiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    adminUi: adminUiReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  devTools: process.env.NODE_ENV !== "production",
});
