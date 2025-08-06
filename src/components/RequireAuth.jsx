import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import { useVerifyQuery } from "slices/authApiSlice";

export default function RequireAuth({ children }) {
  /* ① hook 1: luôn gọi */
  const userInfo = useSelector((s) => s.auth.userInfo);

  /* ② hook 2: luôn gọi – chỉ skip request, không skip hook */
  const { isFetching } = useVerifyQuery(undefined, {
    skip: !userInfo, // chưa có userInfo thì không gửi request
    refetchOnMountOrArgChange: false,
  });

  /* ③ if/return nằm SAU tất cả hook */
  const location = useLocation();

  if (isFetching) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!userInfo) {
    return <Navigate to="/authentication/sign-in" state={{ from: location }} />;
  }

  return children;
}

RequireAuth.propTypes = {
  children: PropTypes.node.isRequired,
};
