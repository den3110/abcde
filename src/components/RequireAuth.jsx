import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import { useVerifyQuery } from "slices/authApiSlice";

export default function RequireAuth({ roles, redirectTo = "/dashboard", children }) {
  const location = useLocation();

  // Gọi verify để lấy user hiện tại
  const { data: user, isFetching, error } = useVerifyQuery();

  if (isFetching) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Nếu 401/403 hoặc không có user => bắt đăng nhập
  const status = error?.status ?? error?.originalStatus;
  if (status === 401 || status === 403 || !user) {
    return <Navigate to="/authentication/sign-in" state={{ from: location }} replace />;
  }

  // Kiểm tra quyền
  const userRoles = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];

  const allowed = !roles || roles.length === 0 ? true : userRoles.some((r) => roles.includes(r));

  if (!allowed) {
    // Thiếu quyền: đá về redirectTo (mặc định /dashboard)
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location, forbidden: true, needRoles: roles }}
      />
    );
  }

  return children;
}

RequireAuth.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.string), // ví dụ: ["admin"] hoặc ["referee"]
  redirectTo: PropTypes.string, // trang fallback khi thiếu quyền
  children: PropTypes.node.isRequired,
};
