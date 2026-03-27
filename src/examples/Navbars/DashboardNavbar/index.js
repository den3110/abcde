/**
=========================================================
* PickleTour React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useState, useEffect, useMemo, useCallback, useDeferredValue } from "react";

// react-router components
import { useLocation, Link, useNavigate } from "react-router-dom";

// redux
import { useDispatch } from "react-redux";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @material-ui core components
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

// PickleTour React components
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";

// PickleTour React example components
import Breadcrumbs from "examples/Breadcrumbs";
import NotificationItem from "examples/Items/NotificationItem";

// Custom styles for DashboardNavbar
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

// PickleTour React context
import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
  setOpenConfigurator,
} from "context";

// auth
import { toast } from "react-toastify";
import { logout as clearAuth } from "slices/authSlice";
import { useLogoutMutation } from "slices/authApiSlice";
import { apiSlice } from "slices/apiSlice";

const SIDENAV_COMMAND_SELECTOR = ".MuiDrawer-root .MuiList-root a[href]";
const DASHBOARD_CONTENT_SELECTOR = "[data-dashboard-content='true']";
const SECTION_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "[role='heading']",
  "legend",
  "label",
  ".MuiFormLabel-root",
].join(",");
const ACTION_SELECTOR = [
  "button:not([disabled])",
  "[role='button']:not([aria-disabled='true'])",
  "a[href]",
].join(",");
const RECENT_COMMANDS_KEY = "admin-command-palette-recent-v1";
const MAX_RECENT_COMMANDS = 8;
const EXCLUDED_ACTION_LABEL = /\b(xoa|delete|remove|huy|destroy|drop)\b/i;

function clearAllCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (!name) return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

const normalizeSearchText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const compactText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const getPathLabelFallback = (pathname = "/") =>
  pathname
    .split("/")
    .filter(Boolean)
    .slice(-1)[0]
    ?.replace(/[-_]+/g, " ")
    ?.replace(/\b\w/g, (char) => char.toUpperCase()) || "Trang hiện tại";

const isElementVisible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const readRecentCommands = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const writeRecentCommands = (items) => {
  localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(items.slice(0, MAX_RECENT_COMMANDS)));
};

const getCommandScore = (command, normalizedQuery) => {
  if (!normalizedQuery) return command.defaultRank ?? 100;

  const label = normalizeSearchText(command.label);
  const sublabel = normalizeSearchText(command.sublabel);
  const keywords = normalizeSearchText(command.keywords);
  const haystack = `${label} ${sublabel} ${keywords}`.trim();

  if (label === normalizedQuery) return 0;
  if (label.startsWith(normalizedQuery)) return 1;
  if (sublabel && sublabel === normalizedQuery) return 2;
  if (sublabel && sublabel.startsWith(normalizedQuery)) return 3;
  if (label.includes(normalizedQuery)) return 4;
  if (sublabel && sublabel.includes(normalizedQuery)) return 5;
  if (keywords && keywords.includes(normalizedQuery)) return 6;
  if (haystack.includes(normalizedQuery)) return 7;

  return Number.POSITIVE_INFINITY;
};

const focusAssociatedField = (element) => {
  if (!(element instanceof HTMLElement)) return;

  const htmlFor = element.getAttribute("for");
  const labelTarget = htmlFor ? document.getElementById(htmlFor) : null;
  const container =
    element.closest(".MuiFormControl-root, .MuiGrid-item, .MuiStack-root, .MuiBox-root") ||
    element.parentElement;
  const fallbackTarget = container?.querySelector(
    "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role='combobox']"
  );
  const target = labelTarget || fallbackTarget;

  if (target instanceof HTMLElement) {
    window.setTimeout(() => {
      target.focus({ preventScroll: true });
      if ("select" in target && typeof target.select === "function") target.select();
    }, 120);
  }
};

const scrollElementIntoView = (element) => {
  if (!(element instanceof HTMLElement)) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
};

function DashboardNavbar({ absolute, light, isMini }) {
  const [navbarType, setNavbarType] = useState();
  const [controller, dispatchCtrl] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, openConfigurator, darkMode } = controller;
  const [openMenu, setOpenMenu] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [routeCommands, setRouteCommands] = useState([]);
  const [sectionCommands, setSectionCommands] = useState([]);
  const [pageActionCommands, setPageActionCommands] = useState([]);
  const [recentCommands, setRecentCommands] = useState(() => readRecentCommands());
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);

  const dispatch = useDispatch();
  const [logoutApi] = useLogoutMutation();
  const location = useLocation();
  const navigate = useNavigate();
  const deferredCommandQuery = useDeferredValue(commandQuery);
  const route = location.pathname.split("/").slice(1);

  useEffect(() => {
    if (fixedNavbar) {
      setNavbarType("sticky");
    } else {
      setNavbarType("static");
    }

    function handleTransparentNavbar() {
      setTransparentNavbar(dispatchCtrl, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }

    window.addEventListener("scroll", handleTransparentNavbar);
    handleTransparentNavbar();

    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatchCtrl, fixedNavbar]);

  const handleMiniSidenav = useCallback(
    () => setMiniSidenav(dispatchCtrl, !miniSidenav),
    [dispatchCtrl, miniSidenav]
  );

  const handleConfiguratorOpen = useCallback(
    () => setOpenConfigurator(dispatchCtrl, !openConfigurator),
    [dispatchCtrl, openConfigurator]
  );

  const handleOpenMenu = (event) => setOpenMenu(event.currentTarget);
  const handleCloseMenu = () => setOpenMenu(false);

  const collectRouteCommands = useCallback(() => {
    if (typeof document === "undefined") return [];

    const seen = new Set();

    return Array.from(document.querySelectorAll(SIDENAV_COMMAND_SELECTOR))
      .map((anchor, index) => {
        const rawHref = anchor.getAttribute("href");
        const label = compactText(anchor.textContent);

        if (!rawHref || !label) return null;

        const path = new URL(rawHref, window.location.origin).pathname;
        if (!path || path === "/" || path.startsWith("/authentication") || seen.has(path)) {
          return null;
        }

        seen.add(path);

        return {
          id: `route-${path}-${index}`,
          type: "route",
          group: "Trang",
          label,
          sublabel: path,
          keywords: `${label} ${path}`,
          defaultRank: path === location.pathname ? 25 : 40 + index,
          execute: () => {
            navigate(path);
          },
          path,
        };
      })
      .filter(Boolean);
  }, [location.pathname, navigate]);

  const collectSectionCommands = useCallback(() => {
    const root = document.querySelector(DASHBOARD_CONTENT_SELECTOR);
    if (!(root instanceof HTMLElement)) return [];

    const seen = new Set();

    return Array.from(root.querySelectorAll(SECTION_SELECTOR))
      .filter(isElementVisible)
      .map((element, index) => {
        const label = compactText(element.textContent);
        if (!label || label.length < 2) return null;

        const key = normalizeSearchText(label);
        if (seen.has(key)) return null;
        seen.add(key);

        return {
          id: `section-${index}-${key}`,
          type: "section",
          group: "Mục trong trang",
          label,
          sublabel: "Cuộn tới mục này",
          keywords: `${label} section field label`,
          defaultRank: 140 + index,
          execute: () => {
            scrollElementIntoView(element);
            focusAssociatedField(element);
          },
        };
      })
      .filter(Boolean)
      .slice(0, 80);
  }, []);

  const collectPageActionCommands = useCallback(() => {
    const root = document.querySelector(DASHBOARD_CONTENT_SELECTOR);
    if (!(root instanceof HTMLElement)) return [];

    const seen = new Set();

    return Array.from(root.querySelectorAll(ACTION_SELECTOR))
      .filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (!isElementVisible(element)) return false;
        if (element.closest("[role='dialog']")) return false;
        return true;
      })
      .map((element, index) => {
        const label = compactText(
          element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            element.textContent ||
            ""
        );

        if (!label || label.length < 2 || EXCLUDED_ACTION_LABEL.test(normalizeSearchText(label))) {
          return null;
        }

        const key = `${element.tagName.toLowerCase()}-${normalizeSearchText(label)}`;
        if (seen.has(key)) return null;
        seen.add(key);

        const isLink = element instanceof HTMLAnchorElement && Boolean(element.getAttribute("href"));

        return {
          id: `action-${index}-${key}`,
          type: "page-action",
          group: "Thao tác trong trang",
          label,
          sublabel: isLink ? "Mở liên kết trong trang" : "Chạy thao tác này",
          keywords: `${label} action button thao tac`,
          defaultRank: 220 + index,
          execute: () => {
            scrollElementIntoView(element);
            window.setTimeout(() => {
              element.click();
            }, 120);
          },
        };
      })
      .filter(Boolean)
      .slice(0, 40);
  }, []);

  const refreshCommandSources = useCallback(() => {
    setRouteCommands(collectRouteCommands());
    setSectionCommands(collectSectionCommands());
    setPageActionCommands(collectPageActionCommands());
  }, [collectPageActionCommands, collectRouteCommands, collectSectionCommands]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi().unwrap();
    } catch (_) {
      // ignore server logout errors
    }

    clearAllCookies();
    localStorage.removeItem("userInfo");
    dispatch(clearAuth());
    dispatch(apiSlice.util.resetApiState());
    navigate("/authentication/sign-in", { replace: true });
  }, [dispatch, logoutApi, navigate]);

  const utilityCommands = useMemo(
    () => [
      {
        id: "utility-reload",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Tải lại trang",
        sublabel: "Reload trang hiện tại",
        keywords: "reload refresh tai lai lam moi",
        defaultRank: 300,
        execute: () => window.location.reload(),
      },
      {
        id: "utility-back",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Quay lại",
        sublabel: "Đi về trang trước",
        keywords: "back quay lai previous",
        defaultRank: 301,
        execute: () => navigate(-1),
      },
      {
        id: "utility-forward",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Đi tiếp",
        sublabel: "Đi tới trang sau",
        keywords: "forward next di tiep",
        defaultRank: 302,
        execute: () => navigate(1),
      },
      {
        id: "utility-top",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Cuộn lên đầu trang",
        sublabel: "Scroll top",
        keywords: "top dau trang scroll len",
        defaultRank: 303,
        execute: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      },
      {
        id: "utility-bottom",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Cuộn xuống cuối trang",
        sublabel: "Scroll bottom",
        keywords: "bottom cuoi trang scroll xuong",
        defaultRank: 304,
        execute: () =>
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }),
      },
      {
        id: "utility-sidebar",
        type: "utility",
        group: "Lệnh nhanh",
        label: miniSidenav ? "Mở sidebar" : "Thu gọn sidebar",
        sublabel: miniSidenav ? "Hiện menu bên trái" : "Ẩn bớt menu bên trái",
        keywords: "sidebar menu left collapse expand",
        defaultRank: 305,
        execute: handleMiniSidenav,
      },
      {
        id: "utility-configurator",
        type: "utility",
        group: "Lệnh nhanh",
        label: openConfigurator ? "Đóng configurator" : "Mở configurator",
        sublabel: "Bật/tắt panel cấu hình",
        keywords: "configurator settings cau hinh",
        defaultRank: 306,
        execute: handleConfiguratorOpen,
      },
      {
        id: "utility-copy-url",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Sao chép URL hiện tại",
        sublabel: window.location.href,
        keywords: "copy url link current sao chep",
        defaultRank: 307,
        execute: async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success("Đã sao chép URL hiện tại.");
          } catch (_) {
            toast.error("Không sao chép được URL.");
          }
        },
      },
      {
        id: "utility-open-new-tab",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Mở trang hiện tại ở tab mới",
        sublabel: location.pathname,
        keywords: "new tab open current page",
        defaultRank: 308,
        execute: () => window.open(window.location.href, "_blank", "noopener,noreferrer"),
      },
      {
        id: "utility-logout",
        type: "utility",
        group: "Lệnh nhanh",
        label: "Đăng xuất",
        sublabel: "Thoát phiên admin hiện tại",
        keywords: "logout dang xuat thoat",
        defaultRank: 309,
        execute: handleLogout,
      },
    ],
    [
      handleConfiguratorOpen,
      handleLogout,
      handleMiniSidenav,
      location.pathname,
      miniSidenav,
      openConfigurator,
    ]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      refreshCommandSources();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, refreshCommandSources]);

  useEffect(() => {
    const currentLabel =
      routeCommands.find((item) => item.path === location.pathname)?.label ||
      compactText(
        document.querySelector(".MuiBreadcrumbs-root li:last-child, .MuiBreadcrumbs-root p:last-child")
          ?.textContent
      ) ||
      getPathLabelFallback(location.pathname);

    setRecentCommands((previous) => {
      const nextRecent = [
        { path: location.pathname, label: currentLabel },
        ...previous.filter((item) => item.path !== location.pathname),
      ].slice(0, MAX_RECENT_COMMANDS);

      writeRecentCommands(nextRecent);
      return nextRecent;
    });
  }, [location.pathname, routeCommands]);

  const recentRouteCommands = useMemo(() => {
    if (deferredCommandQuery.trim()) return [];

    return recentCommands
      .map((recent, index) => {
        const matchedRoute = routeCommands.find((item) => item.path === recent.path);
        return {
          id: `recent-${recent.path}-${index}`,
          type: "recent",
          group: "Gần đây",
          label: matchedRoute?.label || recent.label,
          sublabel: recent.path,
          keywords: `${recent.label} ${recent.path} gan day recent`,
          defaultRank: index,
          execute: () => navigate(recent.path),
          path: recent.path,
        };
      })
      .filter(Boolean);
  }, [deferredCommandQuery, navigate, recentCommands, routeCommands]);

  const commandResults = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredCommandQuery);

    return [
      ...recentRouteCommands,
      ...routeCommands,
      ...sectionCommands,
      ...pageActionCommands,
      ...utilityCommands,
    ]
      .map((command, index) => ({
        ...command,
        index,
        score: getCommandScore(command, normalizedQuery),
      }))
      .filter((command) => Number.isFinite(command.score))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .slice(0, 24);
  }, [
    deferredCommandQuery,
    pageActionCommands,
    recentRouteCommands,
    routeCommands,
    sectionCommands,
    utilityCommands,
  ]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandPaletteOpen, deferredCommandQuery]);

  useEffect(() => {
    if (activeCommandIndex < commandResults.length) return;
    setActiveCommandIndex(Math.max(0, commandResults.length - 1));
  }, [activeCommandIndex, commandResults.length]);

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
    setCommandQuery("");
    setActiveCommandIndex(0);
  }, []);

  const handleSelectCommand = useCallback(
    async (command) => {
      if (!command?.execute) return;

      handleCloseCommandPalette();
      await Promise.resolve(command.execute());
    },
    [handleCloseCommandPalette]
  );

  const handleOpenCommandPalette = useCallback(() => {
    refreshCommandSources();
    setCommandPaletteOpen(true);
  }, [refreshCommandSources]);

  // Render the notifications menu
  const renderMenu = () => (
    <Menu
      anchorEl={openMenu}
      anchorReference={null}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      open={Boolean(openMenu)}
      onClose={handleCloseMenu}
      sx={{ mt: 2 }}
    >
      <NotificationItem icon={<Icon>email</Icon>} title="Check new messages" />
      <NotificationItem icon={<Icon>podcasts</Icon>} title="Manage Podcast sessions" />
      <NotificationItem icon={<Icon>shopping_cart</Icon>} title="Payment successfully completed" />
    </Menu>
  );

  // Styles for the navbar icons
  const iconsStyle = ({ palette: { dark, white, text }, functions: { rgba } }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;

      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }

      return colorValue;
    },
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const target = event.target;
        const isEditable =
          target instanceof HTMLElement &&
          (target.closest("input, textarea, [contenteditable='true'], [role='textbox']") ||
            target.isContentEditable);

        if (isEditable && !commandPaletteOpen) return;

        event.preventDefault();

        if (commandPaletteOpen) {
          handleCloseCommandPalette();
        } else {
          handleOpenCommandPalette();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, handleCloseCommandPalette, handleOpenCommandPalette]);

  return (
    <>
      <AppBar
        position={absolute ? "absolute" : navbarType}
        color="inherit"
        sx={(theme) => navbar(theme, { transparentNavbar, absolute, light, darkMode })}
      >
        <Toolbar sx={(theme) => navbarContainer(theme)}>
          <MDBox
            color="inherit"
            mb={{ xs: 1, md: 0 }}
            sx={(theme) => navbarRow(theme, { isMini })}
          >
            <Breadcrumbs icon="home" title={route[route.length - 1]} route={route} light={light} />
          </MDBox>
          {isMini ? null : (
            <MDBox sx={(theme) => navbarRow(theme, { isMini })}>
              <MDBox pr={1}>
                <MDInput
                  placeholder="Ctrl+K de mo bang lenh..."
                  onClick={handleOpenCommandPalette}
                  inputProps={{ readOnly: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon fontSize="small">search</Icon>
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Chip
                          label="Ctrl K"
                          size="small"
                          variant="outlined"
                          sx={{ borderRadius: 1.5, fontWeight: 700 }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    minWidth: { xs: 190, md: 290 },
                    "& .MuiOutlinedInput-root": {
                      cursor: "pointer",
                    },
                    "& input": {
                      cursor: "pointer",
                    },
                  }}
                />
              </MDBox>
              <MDBox color={light ? "white" : "inherit"}>
                <Link to="/authentication/sign-in/basic">
                  <IconButton sx={navbarIconButton} size="small" disableRipple>
                    <Icon sx={iconsStyle}>account_circle</Icon>
                  </IconButton>
                </Link>
                <IconButton
                  size="small"
                  disableRipple
                  color="inherit"
                  sx={navbarMobileMenu}
                  onClick={handleMiniSidenav}
                >
                  <Icon sx={iconsStyle} fontSize="medium">
                    {miniSidenav ? "menu_open" : "menu"}
                  </Icon>
                </IconButton>
                <IconButton
                  size="small"
                  disableRipple
                  color="inherit"
                  sx={navbarIconButton}
                  onClick={handleConfiguratorOpen}
                >
                  <Icon sx={iconsStyle}>settings</Icon>
                </IconButton>
                <IconButton
                  size="small"
                  disableRipple
                  color="inherit"
                  sx={navbarIconButton}
                  aria-controls="notification-menu"
                  aria-haspopup="true"
                  variant="contained"
                  onClick={handleOpenMenu}
                >
                  <Icon sx={iconsStyle}>notifications</Icon>
                </IconButton>
                {renderMenu()}
              </MDBox>
            </MDBox>
          )}
        </Toolbar>
      </AppBar>

      <Dialog
        open={commandPaletteOpen}
        onClose={handleCloseCommandPalette}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <MDBox p={2}>
            <MDInput
              autoFocus
              fullWidth
              placeholder="Tìm trang, mục trong trang, thao tác, hoặc lệnh nhanh..."
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveCommandIndex((prev) => Math.min(prev + 1, commandResults.length - 1));
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveCommandIndex((prev) => Math.max(prev - 1, 0));
                  return;
                }

                if (event.key === "Home") {
                  event.preventDefault();
                  setActiveCommandIndex(0);
                  return;
                }

                if (event.key === "End") {
                  event.preventDefault();
                  setActiveCommandIndex(Math.max(0, commandResults.length - 1));
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  handleCloseCommandPalette();
                  return;
                }

                if (event.key === "Enter" && commandResults[activeCommandIndex]) {
                  event.preventDefault();
                  handleSelectCommand(commandResults[activeCommandIndex]);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon fontSize="small">search</Icon>
                  </InputAdornment>
                ),
              }}
            />
          </MDBox>

          <Divider />

          <Box
            sx={{
              px: 2.5,
              py: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              bgcolor: "background.default",
            }}
          >
            <Chip size="small" variant="outlined" label="Trang" />
            <Chip size="small" variant="outlined" label="Muc trong trang" />
            <Chip size="small" variant="outlined" label="Thao tac" />
            <Chip size="small" variant="outlined" label="Lenh nhanh" />
            <Chip size="small" variant="outlined" label="Mui ten de di chuyen" />
            <Chip size="small" variant="outlined" label="Enter de chay" />
          </Box>

          <Divider />

          <List sx={{ py: 0, maxHeight: 460, overflowY: "auto" }}>
            {commandResults.length === 0 ? (
              <MDBox px={2.5} py={3}>
                <Typography variant="body2" fontWeight={700}>
                  Khong tim thay ket qua phu hop
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Thu theo ten trang, ten field, nut tren trang, hoac lenh nhanh nhu reload, back,
                  copy url, dang xuat.
                </Typography>
              </MDBox>
            ) : (
              commandResults.map((command, index) => (
                <ListItemButton
                  key={command.id}
                  onClick={() => handleSelectCommand(command)}
                  selected={index === activeCommandIndex}
                  sx={{ px: 2.5, py: 1.25, alignItems: "flex-start" }}
                >
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {command.label}
                        </Typography>
                        <Chip
                          label={command.group}
                          size="small"
                          variant={command.group === "Lệnh nhanh" ? "filled" : "outlined"}
                          color={command.group === "Lệnh nhanh" ? "info" : "default"}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.35 }}>
                        <Typography variant="caption" sx={{ display: "block", lineHeight: 1.5 }}>
                          {command.sublabel}
                        </Typography>
                      </Box>
                    }
                  />
                  {"path" in command && command.path === location.pathname ? (
                    <Chip label="Hien tai" size="small" color="success" variant="outlined" />
                  ) : null}
                </ListItemButton>
              ))
            )}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Setting default values for the props of DashboardNavbar
DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
};

// Typechecking props for the DashboardNavbar
DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;
