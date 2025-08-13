// src/examples/Sidenav/index.jsx
/* eslint-disable react/prop-types */
import { useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

// @mui material
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";

// Components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";

// Context
import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { logout as clearAuth } from "slices/authSlice";
import { useLogoutMutation } from "slices/authApiSlice";
import { apiSlice } from "slices/apiSlice";

// Icons
import LogoutIcon from "@mui/icons-material/Logout";

/* ───────────────── helpers ───────────────── */
function clearAllCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

// helpers role
const getUserRoles = (user) => {
  if (!user) return [];
  if (Array.isArray(user.roles)) return user.roles;
  if (typeof user.role === "string") return [user.role];
  return [];
};

const canView = (route, user) => {
  // route không private -> ai cũng xem được (trừ khi show=false)
  if (!route.private) return route.show !== false;
  // private -> cần đăng nhập
  if (!user) return false;
  // nếu có roles -> phải khớp ít nhất 1
  if (route.roles && route.roles.length > 0) {
    const roles = getUserRoles(user);
    return roles.some((r) => route.roles.includes(r));
  }
  return true;
};

/* ───────────────── component ───────────────── */
function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatchCtrl] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode, sidenavColor } = controller;

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [logoutApi] = useLogoutMutation();

  // lấy user để lọc menu theo role
  const { userInfo } = useSelector((s) => s.auth || {});

  // màu chữ theo nền
  let textColor = "white";
  if (transparentSidenav || (whiteSidenav && !darkMode)) {
    textColor = "dark";
  } else if (whiteSidenav && darkMode) {
    textColor = "inherit";
  }

  const closeSidenav = () => setMiniSidenav(dispatchCtrl, true);

  // phản ứng theo độ rộng màn hình
  useEffect(() => {
    function handleMiniSidenav() {
      const isNarrow = window.innerWidth < 1200;
      setMiniSidenav(dispatchCtrl, isNarrow);
      setTransparentSidenav(dispatchCtrl, isNarrow ? false : transparentSidenav);
      setWhiteSidenav(dispatchCtrl, isNarrow ? false : whiteSidenav);
    }
    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav();
    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatchCtrl, transparentSidenav, whiteSidenav]);

  // Build menu items (lọc theo role + private + show)
  const renderRoutes = routes
    .filter((r) => r.show !== false) // vẫn tôn trọng show=false để ẩn form/edit
    .map((cfg) => {
      const { type, name, icon, title, noCollapse, key, href, route } = cfg;

      if (type === "collapse") {
        // chặn hiển thị nếu không đủ quyền
        if (!canView(cfg, userInfo)) return null;

        const active = route ? location.pathname.startsWith(route) : false;

        return href ? (
          <Link
            href={href}
            key={key}
            target="_blank"
            rel="noreferrer"
            sx={{ textDecoration: "none" }}
            aria-label={`Mở ${name} trong tab mới`}
          >
            <SidenavCollapse name={name} icon={icon} active={active} noCollapse={noCollapse} />
          </Link>
        ) : (
          <NavLink
            key={key}
            to={route}
            style={{ textDecoration: "none" }}
            aria-label={`Đi tới ${name}`}
          >
            <SidenavCollapse name={name} icon={icon} active={active} noCollapse={noCollapse} />
          </NavLink>
        );
      }

      // Title/Divider: hiển thị bình thường (không gắn role)
      if (type === "title") {
        return (
          <MDTypography
            key={key}
            color={textColor}
            display="block"
            variant="caption"
            fontWeight="bold"
            textTransform="uppercase"
            pl={3}
            mt={2}
            mb={1}
            ml={1}
          >
            {title}
          </MDTypography>
        );
      }

      if (type === "divider") {
        return (
          <Divider
            key={key}
            light={
              (!darkMode && !whiteSidenav && !transparentSidenav) ||
              (darkMode && !transparentSidenav && whiteSidenav)
            }
          />
        );
      }

      return null;
    });

  // Đăng xuất
  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // bỏ qua lỗi logout server
    }
    clearAllCookies();
    localStorage.removeItem("userInfo");
    dispatch(clearAuth());
    dispatch(apiSlice.util.resetApiState());
    navigate("/authentication/sign-in", { replace: true });
  };

  return (
    <SidenavRoot
      {...rest}
      variant="permanent"
      ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
    >
      {/* Logo & Brand */}
      <MDBox pt={3} pb={1} px={4} textAlign="center">
        <MDBox
          display={{ xs: "block", xl: "none" }}
          position="absolute"
          top={0}
          right={0}
          p={1.625}
          onClick={closeSidenav}
          sx={{ cursor: "pointer" }}
          aria-label="Đóng thanh điều hướng"
          title="Đóng"
        >
          {/* lưu ý: Icon dùng tên biểu tượng, không phải text hiển thị */}
          <Icon sx={{ fontWeight: "bold" }}>close</Icon>
        </MDBox>

        <MDBox
          component={NavLink}
          to="/"
          display="flex"
          alignItems="center"
          aria-label="Về trang chủ"
          title="Trang chủ"
          style={{ textDecoration: "none" }}
        >
          {brand && <MDBox component="img" src={brand} alt="Logo" width="2rem" />}
          <MDBox
            width={!brandName && "100%"}
            sx={(theme) => sidenavLogoLabel(theme, { miniSidenav })}
          >
            <MDTypography component="h6" variant="button" fontWeight="medium" color={textColor}>
              {brandName}
            </MDTypography>
          </MDBox>
        </MDBox>
      </MDBox>

      <Divider
        light={
          (!darkMode && !whiteSidenav && !transparentSidenav) ||
          (darkMode && !transparentSidenav && whiteSidenav)
        }
      />

      {/* Menu */}
      <List>{renderRoutes}</List>

      {/* Nút đăng xuất */}
      <MDBox p={2} mt="auto">
        <MDButton
          variant="gradient"
          color={sidenavColor}
          fullWidth
          onClick={handleLogout}
          startIcon={<LogoutIcon />}
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          Đăng xuất
        </MDButton>
      </MDBox>
    </SidenavRoot>
  );
}

Sidenav.defaultProps = {
  color: "info",
  brand: "",
};

Sidenav.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  brand: PropTypes.string,
  brandName: PropTypes.string.isRequired,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;
