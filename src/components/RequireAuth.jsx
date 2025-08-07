import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import { useVerifyQuery } from "slices/authApiSlice";

export default function RequireAuth({ children }) {
  const location = useLocation();

  // Always call verify
  const { data: user, isFetching, error } = useVerifyQuery();

  if (isFetching) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // On 401 or 403 (caught by baseQuery) the user will already be logged out
  // and redirected. But just in case:
  const status = error?.status || error?.originalStatus;
  if (status === 401 || status === 403 || !user) {
    return <Navigate to="/authentication/sign-in" state={{ from: location }} replace />;
  }

  // user now contains { _id, name, email, role, token }
  // you can dispatch it into your authSlice if you like:
  // useEffect(() => { dispatch(setCredentials(user)) }, [user])

  return children;
}

RequireAuth.propTypes = {
  children: PropTypes.node.isRequired,
};
