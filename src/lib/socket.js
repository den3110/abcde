import { io } from "socket.io-client";

// URL API của bạn (ví dụ từ .env)
const API_URL = process.env.REACT_APP_SOCKET_URL;

export const socket = io(API_URL, {
  path: "/socket.io", // khớp app.js
  withCredentials: true, // vì CORS dùng credentials
  autoConnect: false, // tự điều khiển connect
  transports: ["websocket"], // ưu tiên ws
  reconnection: true,
  auth: (cb) => cb({}),
});

export function connectSocketWithToken(token) {
  socket.auth = { token: `Bearer ${token}` }; // <<< bơm token ở đây
  if (!socket.connected) socket.connect();
}

// thêm debug để biết bị gì
socket.on("connect_error", (err) => {
  if (err?.message === "Unauthorized") {
    console.warn("JWT hết hạn/không hợp lệ");
  } else {
    console.error("connect_error:", err.message, err);
  }
});
socket.on("error", (err) => {
  console.error("error:", err);
});
