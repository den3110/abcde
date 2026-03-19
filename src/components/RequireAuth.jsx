import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { Navigate, useLocation } from "react-router-dom";
import { useVerifyQuery } from "slices/authApiSlice";
import { getUserRoles, isStrictSuperAdminUser, normalizeRole } from "utils/authz";

function extractUser(data) {
  if (!data) return null;
  if (data.user && typeof data.user === "object") return data.user;
  return data;
}

export default function RequireAuth({
  roles,
  redirectTo = "/dashboard",
  requireAdminAndSuperAdmin = false,
  children,
}) {
  const location = useLocation();
  const { data, isFetching, error } = useVerifyQuery();
  const user = extractUser(data);

  if (isFetching) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const status = error?.status ?? error?.originalStatus;
  if (status === 401 || status === 403 || !user) {
    return <Navigate to="/authentication/sign-in" state={{ from: location }} replace />;
  }

  const userRoles = getUserRoles(user);
  const wantedRoles = (roles || []).map(normalizeRole).filter(Boolean);
  const allowed =
    wantedRoles.length === 0 ? true : wantedRoles.some((role) => userRoles.includes(role));

  if (!allowed || (requireAdminAndSuperAdmin && !isStrictSuperAdminUser(user))) {
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
  roles: PropTypes.arrayOf(PropTypes.string),
  redirectTo: PropTypes.string,
  requireAdminAndSuperAdmin: PropTypes.bool,
  children: PropTypes.node.isRequired,
};
