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
const FIELD_SELECTOR = [
  "input:not([type='hidden']):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[role='combobox']",
].join(",");
const RECENT_COMMANDS_KEY = "admin-command-palette-recent-v1";
const MAX_RECENT_COMMANDS = 8;
const EXCLUDED_ACTION_LABEL = /\b(xoa|delete|remove|huy|destroy|drop)\b/i;
const COMMAND_GROUP_META = {
  Trang: {
    icon: "dashboard_customize",
    color: "primary",
  },
  "Mục trong trang": {
    icon: "segment",
    color: "secondary",
  },
  "Thao tác trong trang": {
    icon: "bolt",
    color: "warning",
  },
  "Trường dữ liệu": {
    icon: "rule",
    color: "error",
  },
  "Lệnh nhanh": {
    icon: "terminal",
    color: "info",
  },
  "Gần đây": {
    icon: "history",
    color: "success",
  },
};

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
const stripRouteAriaPrefix = (value = "") =>
  compactText(value)
    .replace(/^Đi tới\s+/i, "")
    .replace(/^Mở\s+/i, "")
    .replace(/\s+trong tab mới$/i, "");
const getPathKeywords = (pathname = "/") => pathname.split("/").filter(Boolean).join(" ");

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

const getAnchorCommandLabel = (anchor) => {
  if (!(anchor instanceof HTMLElement)) return "";

  const textElement = anchor.querySelector(
    ".MuiListItemText-root .MuiTypography-root, .MuiListItemText-root"
  );
  const textLabel = compactText(textElement?.textContent);
  if (textLabel) return textLabel;

  const ariaLabel = stripRouteAriaPrefix(anchor.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;

  const clone = anchor.cloneNode(true);
  clone
    .querySelectorAll(
      ".MuiListItemIcon-root, .material-icons, .material-icons-round, .material-icons-outlined, svg"
    )
    .forEach((node) => node.remove());

  return compactText(clone.textContent);
};

const getAnchorSectionLabel = (anchor) => {
  if (!(anchor instanceof HTMLElement)) return "";

  let sibling = anchor.previousElementSibling;
  let depth = 0;

  while (sibling && depth < 8) {
    const text = compactText(sibling.textContent);
    if (text && !sibling.querySelector("a[href]")) return text;
    sibling = sibling.previousElementSibling;
    depth += 1;
  }

  return "";
};

const getFieldLabel = (element, root) => {
  if (!(element instanceof HTMLElement)) return "";

  const id = element.getAttribute("id");
  const safeId = id && typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
  const explicitLabel =
    safeId && root instanceof HTMLElement
      ? root.querySelector(`label[for="${safeId}"], .MuiFormLabel-root[for="${safeId}"]`)
      : null;

  const container =
    element.closest(
      ".MuiFormControl-root, .MuiGrid-item, .MuiStack-root, .MuiBox-root, .MuiTableCell-root, .MuiPaper-root"
    ) || element.parentElement;
  const containerLabel = container?.querySelector(
    "label, .MuiFormLabel-root, legend, .MuiInputLabel-root"
  );
  const inputChild =
    element.matches("input, textarea, select")
      ? element
      : element.querySelector("input, textarea, select");

  return compactText(
    explicitLabel?.textContent ||
      containerLabel?.textContent ||
      element.getAttribute("aria-label") ||
      inputChild?.getAttribute("aria-label") ||
      inputChild?.getAttribute("placeholder") ||
      element.getAttribute("placeholder") ||
      inputChild?.getAttribute("name") ||
      element.getAttribute("name") ||
      ""
  );
};

const getCommandGroupMeta = (group = "") =>
  COMMAND_GROUP_META[group] || {
    icon: "search",
    color: "default",
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
  const [fieldCommands, setFieldCommands] = useState([]);
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
        const label = getAnchorCommandLabel(anchor);
        const sectionLabel = getAnchorSectionLabel(anchor);
        const ariaLabel = stripRouteAriaPrefix(anchor.getAttribute("aria-label"));

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
          sublabel: sectionLabel ? `${sectionLabel} · ${path}` : path,
          keywords: `${label} ${ariaLabel} ${sectionLabel} ${path} ${getPathKeywords(path)}`,
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

  const collectFieldCommands = useCallback(() => {
    const root = document.querySelector(DASHBOARD_CONTENT_SELECTOR);
    if (!(root instanceof HTMLElement)) return [];

    const seen = new Set();

    return Array.from(root.querySelectorAll(FIELD_SELECTOR))
      .filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (!isElementVisible(element)) return false;
        if (element.closest("[role='dialog']")) return false;
        return true;
      })
      .map((element, index) => {
        const label = getFieldLabel(element, root);
        if (!label || label.length < 2) return null;

        const key = `${element.tagName.toLowerCase()}-${normalizeSearchText(label)}`;
        if (seen.has(key)) return null;
        seen.add(key);

        const inputChild =
          element.matches("input, textarea, select")
            ? element
            : element.querySelector("input, textarea, select");
        const placeholder = compactText(
          inputChild?.getAttribute("placeholder") || element.getAttribute("placeholder") || ""
        );
        const helper = compactText(
          element
            .closest(
              ".MuiFormControl-root, .MuiGrid-item, .MuiStack-root, .MuiBox-root, .MuiPaper-root"
            )
            ?.querySelector(".MuiFormHelperText-root")
            ?.textContent
        );

        return {
          id: `field-${index}-${key}`,
          type: "field",
          group: "Trường dữ liệu",
          label,
          sublabel: compactText(helper || placeholder || "Cuộn tới và focus trường này"),
          keywords: `${label} ${placeholder} ${helper} input field form bo loc filter search`,
          defaultRank: 180 + index,
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
    setFieldCommands(collectFieldCommands());
    setPageActionCommands(collectPageActionCommands());
  }, [collectFieldCommands, collectPageActionCommands, collectRouteCommands, collectSectionCommands]);

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
      ...fieldCommands,
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
    fieldCommands,
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
                  placeholder="Tìm nhanh mọi thứ..."
                  onClick={handleOpenCommandPalette}
                  inputProps={{ readOnly: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Icon
                          fontSize="small"
                          sx={{
                            color: "primary.main",
                          }}
                        >
                          search
                        </Icon>
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end" sx={{ gap: 0.5 }}>
                        <Chip
                          label="Ctrl"
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 24,
                            borderRadius: 1.5,
                            fontWeight: 700,
                            bgcolor: "rgba(255,255,255,0.82)",
                          }}
                        />
                        <Chip
                          label="K"
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 24,
                            borderRadius: 1.5,
                            fontWeight: 700,
                            bgcolor: "rgba(255,255,255,0.82)",
                          }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    minWidth: { xs: 220, md: 340 },
                    "& .MuiOutlinedInput-root": {
                      cursor: "pointer",
                      borderRadius: 999,
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(247,250,255,0.98) 100%)",
                      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                      transition: "transform 0.18s ease, box-shadow 0.18s ease",
                      "& fieldset": {
                        borderColor: "rgba(59, 130, 246, 0.18)",
                      },
                      "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: "0 14px 34px rgba(37, 99, 235, 0.14)",
                        "& fieldset": {
                          borderColor: "rgba(59, 130, 246, 0.3)",
                        },
                      },
                    },
                    "& input": {
                      cursor: "pointer",
                      fontWeight: 600,
                    },
                    "& input::placeholder": {
                      color: "text.primary",
                      opacity: 0.82,
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
        sx={{
          "& .MuiBackdrop-root": {
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(15, 23, 42, 0.28)",
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            boxShadow: "0 30px 80px rgba(15, 23, 42, 0.28)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <MDBox
            px={2.5}
            pt={2.5}
            pb={2}
            sx={{
              background:
                "linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(255,255,255,0.92) 100%)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "center" },
                gap: 1.5,
                flexWrap: "wrap",
                mb: 1.75,
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                  Command Palette
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Tìm trang, nhảy tới field, chạy nút trên màn hình hoặc gọi lệnh nhanh.
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  icon={<Icon sx={{ fontSize: "0.95rem !important" }}>keyboard_command_key</Icon>}
                  label="Ctrl K"
                  sx={{
                    bgcolor: "rgba(37, 99, 235, 0.1)",
                    color: "primary.main",
                    fontWeight: 700,
                  }}
                />
                <Chip
                  size="small"
                  label="↑ ↓ Di chuyển"
                  sx={{
                    bgcolor: "rgba(15, 23, 42, 0.06)",
                    fontWeight: 600,
                  }}
                />
                <Chip
                  size="small"
                  label="Enter Chạy"
                  sx={{
                    bgcolor: "rgba(15, 23, 42, 0.06)",
                    fontWeight: 600,
                  }}
                />
              </Box>
            </Box>
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
                    <Icon fontSize="small" sx={{ color: "primary.main" }}>
                      search
                    </Icon>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {commandResults.length} kết quả
                    </Typography>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,0.92)",
                  boxShadow: "0 12px 34px rgba(37, 99, 235, 0.08)",
                  "& fieldset": {
                    borderColor: "rgba(59, 130, 246, 0.18)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "primary.main",
                    borderWidth: 1,
                  },
                },
              }}
            />
          </MDBox>

          <Divider />

          <Box
            sx={{
              px: 2.5,
              py: 1.25,
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              bgcolor: "rgba(248, 250, 252, 0.95)",
            }}
          >
            <Chip size="small" variant="outlined" label="Trang" />
            <Chip size="small" variant="outlined" label="Mục trong trang" />
            <Chip size="small" variant="outlined" label="Trường dữ liệu" />
            <Chip size="small" variant="outlined" label="Thao tác" />
            <Chip size="small" variant="outlined" label="Lệnh nhanh" />
            <Chip size="small" variant="outlined" label="↑ ↓ để di chuyển" />
            <Chip size="small" variant="outlined" label="Enter để chạy" />
          </Box>

          <Divider />

          <List
            sx={{
              py: 1,
              px: 1,
              maxHeight: 460,
              overflowY: "auto",
              bgcolor: "rgba(255,255,255,0.88)",
            }}
          >
            {commandResults.length === 0 ? (
              <MDBox
                px={2.5}
                py={4}
                sx={{
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    mx: "auto",
                    mb: 1.5,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(37, 99, 235, 0.1)",
                    color: "primary.main",
                  }}
                >
                  <Icon>search_off</Icon>
                </Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  Không tìm thấy kết quả phù hợp
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Thử theo tên trang, tên field, placeholder, nút trên trang, hoặc lệnh nhanh
                  như reload, back, copy URL, đăng xuất.
                </Typography>
              </MDBox>
            ) : (
              commandResults.map((command, index) => {
                const groupMeta = getCommandGroupMeta(command.group);

                return (
                  <ListItemButton
                    key={command.id}
                    onClick={() => handleSelectCommand(command)}
                    selected={index === activeCommandIndex}
                    sx={(theme) => ({
                      px: 1.5,
                      py: 1.35,
                      alignItems: "flex-start",
                      gap: 1.5,
                      borderRadius: 2.5,
                      mb: 0.5,
                      border: "1px solid transparent",
                      transition: "all 0.16s ease",
                      "&:hover": {
                        bgcolor: "rgba(59, 130, 246, 0.08)",
                        borderColor: "rgba(59, 130, 246, 0.18)",
                      },
                      "&.Mui-selected": {
                        bgcolor: "rgba(37, 99, 235, 0.1)",
                        borderColor: "rgba(37, 99, 235, 0.22)",
                        boxShadow: "0 10px 28px rgba(37, 99, 235, 0.12)",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "rgba(37, 99, 235, 0.14)",
                      },
                      [theme.breakpoints.down("sm")]: {
                        px: 1.25,
                      },
                    })}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        mt: 0.2,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: `${groupMeta.color}.main`,
                        color: "#fff",
                        flexShrink: 0,
                        boxShadow: "0 10px 18px rgba(15, 23, 42, 0.12)",
                      }}
                    >
                      <Icon sx={{ fontSize: "1.05rem !important" }}>{groupMeta.icon}</Icon>
                    </Box>
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Typography variant="body2" fontWeight={700}>
                            {command.label}
                          </Typography>
                          <Chip
                            label={command.group}
                            size="small"
                            color={groupMeta.color}
                            variant={command.group === "Lệnh nhanh" ? "filled" : "outlined"}
                            sx={{ fontWeight: 700 }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.35 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", lineHeight: 1.6 }}
                          >
                            {command.sublabel}
                          </Typography>
                        </Box>
                      }
                    />
                    {"path" in command && command.path === location.pathname ? (
                      <Chip
                        label="Hiện tại"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    ) : null}
                  </ListItemButton>
                );
              })
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
