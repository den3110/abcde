import { createContext, useContext, useEffect } from "react";
import { connectSocketWithToken, socket } from "../lib/socket";
import PropTypes from "prop-types";
const SocketContext = createContext(socket);
import { useSelector } from "react-redux";
export function SocketProvider({ children }) {
  const { userInfo } = useSelector((s) => s.auth || {});
  console.log("SocketProvider", userInfo);
  useEffect(() => {
    if (userInfo?.token) {
      connectSocketWithToken(userInfo?.token);
    } else if (socket.connected) {
      socket.disconnect();
    }
    // không disconnect onUnmount nếu muốn giữ kết nối toàn app
  }, [userInfo?.token]);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
SocketProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
