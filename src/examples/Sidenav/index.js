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
import { getUserRoles, isStrictSuperAdminUser, normalizeRole } from "utils/authz";

// Icons
import LogoutIcon from "@mui/icons-material/Logout";

/* ───────────────── helpers ───────────────── */
function clearAllCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

const canView = (route, user) => {
  // non-private route -> visible unless show=false
  if (!route.private) return route.show !== false;
  // private route -> must be logged in
  if (!user) return false;
  if (route.requireAdminAndSuperAdmin || route.requireAdminAndSuperUser) {
    return isStrictSuperAdminUser(user);
  }
  // if roles are defined -> user needs at least one matching role
  if (route.roles && route.roles.length > 0) {
    const roles = getUserRoles(user);
    const allowed = route.roles.map(normalizeRole).filter(Boolean);
    return roles.some((r) => allowed.includes(r));
  }
  return true;
};

/* ───────────────── gom nhóm menu theo phân loại ───────────────── */
const GROUP_ORDER = [
  "Tổng quan",
  "Sân & Đặt sân",
  "Giải đấu & Trận đấu",
  "Trọng tài & Overlay",
  "Người dùng & Điểm trình",
  "Nội dung & Truyền thông",
  "Email & Tài chính",
  "Livestream · FB · YouTube",
  "Hệ thống & Cấu hình",
  "Giám sát & Nhật ký",
  "Bảo mật & Hạ tầng",
];

// key của route -> nhóm hiển thị. Route không có trong map rơi vào "Khác".
const KEY_GROUP = {
  dashboard: "Tổng quan",

  "venue-management": "Sân & Đặt sân",
  "venue-detail": "Sân & Đặt sân",
  "booking-management": "Sân & Đặt sân",
  "admin-court-free-manager": "Sân & Đặt sân",
  "court-owner-requests": "Sân & Đặt sân",
  reconciliation: "Sân & Đặt sân",

  tournaments: "Giải đấu & Trận đấu",
  "tournament-new": "Giải đấu & Trận đấu",
  "tournament-edit": "Giải đấu & Trận đấu",
  "tournament-registrations": "Giải đấu & Trận đấu",
  "tournament-brackets": "Giải đấu & Trận đấu",
  "admin-matches": "Giải đấu & Trận đấu",
  "match-viewer": "Giải đấu & Trận đấu",
  "admin-match-detail": "Giải đấu & Trận đấu",
  "admin-live-sessions": "Giải đấu & Trận đấu",
  "admin-court-clusters": "Giải đấu & Trận đấu",
  "tournament-matches": "Giải đấu & Trận đấu",
  "tournament-bracket-view": "Giải đấu & Trận đấu",
  "tournament-bracket-story": "Giải đấu & Trận đấu",
  "bracket-preassign": "Giải đấu & Trận đấu",
  "tournament-blueprint": "Giải đấu & Trận đấu",
  "auto-registrations": "Giải đấu & Trận đấu",
  "admin-bracket-courts": "Giải đấu & Trận đấu",
  "rating-tester": "Giải đấu & Trận đấu",
  "bracket-group-insert": "Giải đấu & Trận đấu",
  "ai-registration-import": "Giải đấu & Trận đấu",

  "overlay-index": "Trọng tài & Overlay",
  "admin-referee-console-match": "Trọng tài & Overlay",
  "admin-referee-console": "Trọng tài & Overlay",
  "admin-referee-matches": "Trọng tài & Overlay",
  "referee-matches": "Trọng tài & Overlay",

  "user-management": "Người dùng & Điểm trình",
  "nickname-requests": "Người dùng & Điểm trình",
  "coach-approvals": "Người dùng & Điểm trình",
  "self-assessment-management": "Người dùng & Điểm trình",
  "assessment-history": "Người dùng & Điểm trình",
  "evaluator-management": "Người dùng & Điểm trình",
  "review-moderation": "Người dùng & Điểm trình",
  "auto-users": "Người dùng & Điểm trình",
  "sign-in": "Người dùng & Điểm trình",
  "sign-up": "Người dùng & Điểm trình",

  "admin-news": "Nội dung & Truyền thông",
  "admin-blog": "Nội dung & Truyền thông",
  "admin-feed": "Nội dung & Truyền thông",
  "admin-chat": "Nội dung & Truyền thông",
  "news-list": "Nội dung & Truyền thông",
  "news-detail": "Nội dung & Truyền thông",
  "cms-hero": "Nội dung & Truyền thông",
  "cms-contact": "Nội dung & Truyền thông",
  "admin-sponsors": "Nội dung & Truyền thông",
  "admin-broadcast": "Nội dung & Truyền thông",
  "support-manager": "Nội dung & Truyền thông",
  "news-image-monitor": "Nội dung & Truyền thông",

  "admin-email-campaigns": "Email & Tài chính",
  "admin-email-contacts": "Email & Tài chính",
  "admin-finance": "Email & Tài chính",

  "fb-live-config": "Livestream · FB · YouTube",
  "fb-page-monitor": "Livestream · FB · YouTube",
  "fb-page-tokens": "Livestream · FB · YouTube",
  "event-live-monitor": "Livestream · FB · YouTube",
  "admin-youtube-live": "Livestream · FB · YouTube",
  "admin-live-playback": "Livestream · FB · YouTube",
  "push-realtime": "Livestream · FB · YouTube",
  "live-recording-monitor": "Livestream · FB · YouTube",
  "live-recording-drive-monitor": "Livestream · FB · YouTube",
  "live-recording-ai-commentary-monitor": "Livestream · FB · YouTube",
  "drive-video-manager": "Livestream · FB · YouTube",
  "fb-vod-drive-monitor": "Livestream · FB · YouTube",

  "system-settings": "Hệ thống & Cấu hình",
  "system-config": "Hệ thống & Cấu hình",
  "ai-gateway-settings": "Hệ thống & Cấu hình",
  "zalo-zns-logs": "Hệ thống & Cấu hình",
  "algo-settings": "Hệ thống & Cấu hình",
  "admin-app-version": "Hệ thống & Cấu hình",
  "admin-files": "Hệ thống & Cấu hình",
  "admin-cache-manager": "Hệ thống & Cấu hình",
  "admin-avatar-optimization": "Hệ thống & Cấu hình",
  "admin-ota": "Hệ thống & Cấu hình",

  "admin-primary-logs": "Giám sát & Nhật ký",
  "admin-system-monitor": "Giám sát & Nhật ký",
  "admin-monitor": "Giám sát & Nhật ký",
  "admin-audit-logs": "Giám sát & Nhật ký",
  "auth-log-management": "Giám sát & Nhật ký",
  "admin-peak-runtime": "Giám sát & Nhật ký",
  "admin-observer-vps": "Giám sát & Nhật ký",

  "identity-security": "Bảo mật & Hạ tầng",
  "checkpoint-engine": "Bảo mật & Hạ tầng",
  "admin-azure-config": "Bảo mật & Hạ tầng",
  "admin-azure-manager": "Bảo mật & Hạ tầng",
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
  // Render 1 mục collapse (Link ngoài hoặc NavLink nội bộ)
  const renderCollapseItem = (cfg) => {
    const { name, icon, noCollapse, key, href, route } = cfg;
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
      <NavLink key={key} to={route} style={{ textDecoration: "none" }} aria-label={`Đi tới ${name}`}>
        <SidenavCollapse name={name} icon={icon} active={active} noCollapse={noCollapse} />
      </NavLink>
    );
  };

  // Gom các mục collapse hiển thị được vào nhóm rồi render theo GROUP_ORDER
  const visibleCollapses = routes.filter(
    (r) => r.type === "collapse" && r.show !== false && canView(r, userInfo)
  );
  const buckets = new Map();
  visibleCollapses.forEach((r) => {
    const g = KEY_GROUP[r.key] || "Khác";
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g).push(r);
  });
  const orderedGroups = [
    ...GROUP_ORDER.filter((g) => buckets.has(g)),
    ...[...buckets.keys()].filter((g) => !GROUP_ORDER.includes(g)),
  ];
  const renderRoutes = orderedGroups.map((group, gi) => (
    <MDBox key={`grp-${group}`}>
      {gi > 0 && (
        <Divider
          light={
            (!darkMode && !whiteSidenav && !transparentSidenav) ||
            (darkMode && !transparentSidenav && whiteSidenav)
          }
        />
      )}
      <MDTypography
        color={textColor}
        display="block"
        variant="caption"
        fontWeight="bold"
        textTransform="uppercase"
        pl={3}
        mt={gi === 0 ? 1 : 2}
        mb={1}
        ml={1}
      >
        {group}
      </MDTypography>
      {buckets.get(group).map((cfg) => renderCollapseItem(cfg))}
    </MDBox>
  ));

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
