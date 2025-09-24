// src/pages/AdminAppVersionPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Tabs,
  Tab,
  Stack,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  Divider,
  Alert,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Drawer,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import SecurityIcon from "@mui/icons-material/Security";
import BoltIcon from "@mui/icons-material/Bolt";
import LinkIcon from "@mui/icons-material/Link";
import NotesIcon from "@mui/icons-material/Notes";
import PercentIcon from "@mui/icons-material/Percent";
import SearchIcon from "@mui/icons-material/Search";
import DevicesIcon from "@mui/icons-material/Devices";
import PeopleIcon from "@mui/icons-material/People";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import BlockIcon from "@mui/icons-material/Block";
import UpdateIcon from "@mui/icons-material/SystemUpdateAlt";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import AndroidIcon from "@mui/icons-material/Android";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UsbIcon from "@mui/icons-material/Usb";
import MemoryIcon from "@mui/icons-material/Memory";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PropTypes from "prop-types";

// DataGrid
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import { useGetAppVersionQuery, useUpsertAppVersionMutation } from "slices/versionApiSlice";
import { useGetVersionStatsQuery, useGetUsersVersionQuery } from "slices/adminVersionsApiSlice";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Toastify
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PLATFORMS = ["all", "ios", "android"];

function parseBlocked(s) {
  if (!s) return [];
  return String(s)
    .split(/[,\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n));
}

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString();
}

function StatusPill({ status, newestBuild, cfg, behindBy }) {
  if (status === "blocked")
    return <Chip icon={<BlockIcon />} color="error" label="Blocked" size="small" />;
  if (status === "force")
    return <Chip icon={<BlockIcon />} color="error" label="Bị chặn" size="small" />;
  if (status === "soft")
    return (
      <Chip
        icon={<UpdateIcon />}
        color="warning"
        label={typeof behindBy === "number" && behindBy > 0 ? `Chậm (${behindBy})` : "Chậm"}
        size="small"
      />
    );
  return <Chip color="success" label="OK" size="small" />;
}
StatusPill.propTypes = {
  status: PropTypes.string,
  newestBuild: PropTypes.number,
  cfg: PropTypes.shape({
    latestBuild: PropTypes.number,
    minSupportedBuild: PropTypes.number,
  }),
  behindBy: PropTypes.number,
};

function KeyValue({ k, v, mono = false }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="body2" sx={{ minWidth: 130, color: "text.secondary" }}>
        {k}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? "monospace" : undefined }}>
        {v ?? "—"}
      </Typography>
    </Stack>
  );
}

export default function AdminAppVersionPage() {
  const [tab, setTab] = useState("all"); // all | ios | android

  // fetch 3 cấu hình hiển thị form
  const allQ = useGetAppVersionQuery(undefined);
  const iosQ = useGetAppVersionQuery("ios");
  const androidQ = useGetAppVersionQuery("android");
  const byTab = { all: allQ, ios: iosQ, android: androidQ };
  const q = byTab[tab];

  // form state
  const [latestVersion, setLatestVersion] = useState("");
  const [latestBuild, setLatestBuild] = useState("");
  const [minSupportedBuild, setMinSupportedBuild] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [rolloutPct, setRolloutPct] = useState(100);
  const [rolloutCohort, setRolloutCohort] = useState("deviceId");
  const [blocked, setBlocked] = useState("");
  const [changelog, setChangelog] = useState("");

  // nạp dữ liệu form từ API
  useEffect(() => {
    const d = q?.data;
    if (!d) return;
    setLatestVersion(d.latestVersion ?? "");
    setLatestBuild(String(d.latestBuild ?? ""));
    setMinSupportedBuild(String(d.minSupportedBuild ?? ""));
    setStoreUrl(d.storeUrl ?? "");
    setRolloutPct(d.rollout?.percentage ?? 100);
    setRolloutCohort(d.rollout?.cohortKey ?? "deviceId");
    setBlocked((d.blockedBuilds || []).join(", "));
    setChangelog(d.changelog ?? "");
  }, [q?.data]);

  const [save, saveState] = useUpsertAppVersionMutation();

  const onSave = async () => {
    const body = {
      platform: tab,
      latestVersion: (latestVersion || "").trim(),
      latestBuild: Number(latestBuild),
      minSupportedBuild: Number(minSupportedBuild),
      storeUrl: (storeUrl || "").trim(),
      rollout: { percentage: Number(rolloutPct), cohortKey: rolloutCohort },
      blockedBuilds: parseBlocked(blocked),
      changelog,
    };

    if (!body.latestVersion) return toast.error("latestVersion không được trống");
    if (!Number.isFinite(body.latestBuild)) return toast.error("latestBuild phải là số");
    if (!Number.isFinite(body.minSupportedBuild))
      return toast.error("minSupportedBuild phải là số");
    if (body.rollout.percentage < 0 || body.rollout.percentage > 100)
      return toast.error("rollout % phải nằm trong khoảng 0..100");

    try {
      await save(body).unwrap();
      toast.success(`Đã lưu cấu hình cho ${tab.toUpperCase()}!`);
      q?.refetch && q.refetch();
      statsQ?.refetch && statsQ.refetch();
      usersQ?.refetch && usersQ.refetch();
    } catch (e) {
      const msg = e?.data?.message || e?.error || "Lưu thất bại! Vui lòng kiểm tra dữ liệu.";
      toast.error(msg);
    }
  };

  const behindHint = useMemo(() => {
    const lb = Number(latestBuild);
    const mb = Number(minSupportedBuild);
    if (!Number.isFinite(lb) || !Number.isFinite(mb)) return null;
    if (mb > lb) {
      return { type: "warning", text: "minSupportedBuild > latestBuild — cân nhắc chỉnh lại." };
    }
    return null;
  }, [latestBuild, minSupportedBuild]);

  const handleReload = async () => {
    try {
      await q?.refetch?.();
      toast.info("Đã tải lại cấu hình");
    } catch {
      toast.error("Tải lại thất bại");
    }
  };

  // ====== KHỐI THỐNG KÊ & DANH SÁCH USER ======
  const [filterType, setFilterType] = useState("all"); // all | soft | force
  const [searchText, setSearchText] = useState("");
  const [limit, setLimit] = useState(50);
  const [includeDevices, setIncludeDevices] = useState(true);

  const statsQ = useGetVersionStatsQuery({ platform: tab === "all" ? "" : tab });
  const usersQ = useGetUsersVersionQuery({
    platform: tab === "all" ? "" : tab,
    type: filterType,
    q: searchText,
    limit,
    includeDevices,
  });

  const users = usersQ.data?.rows ?? [];
  const usersCfg = usersQ.data?.config || { latestBuild: 0, minSupportedBuild: 0 };

  // Drawer xem danh sách devices theo user
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);

  const openDevices = (row) => {
    setDrawerUser(row);
    setDrawerOpen(true);
  };

  const closeDevices = () => {
    setDrawerOpen(false);
    setDrawerUser(null);
  };

  // DataGrid columns (mới, tận dụng dữ liệu API mới)
  const columns = useMemo(
    () => [
      {
        field: "userName",
        headerName: "User",
        flex: 1.3,
        minWidth: 170,
        renderCell: (p) => (
          <Stack>
            <Typography fontWeight={700}>{p.value || "—"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {p.row.userEmail || "—"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "platforms",
        headerName: "Platforms",
        width: 120,
        align: "center",
        headerAlign: "center",
        renderCell: (p) => {
          const arr = p.row.platforms || [];
          return (
            <Stack direction="row" spacing={0.5}>
              {arr.includes("ios") && (
                <Tooltip title="iOS">
                  <PhoneIphoneIcon fontSize="small" />
                </Tooltip>
              )}
              {arr.includes("android") && (
                <Tooltip title="Android">
                  <AndroidIcon fontSize="small" />
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
      {
        field: "iosCount",
        headerName: "iOS",
        type: "number",
        width: 80,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "androidCount",
        headerName: "Android",
        type: "number",
        width: 100,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "deviceCount",
        headerName: "Thiết bị",
        type: "number",
        width: 100,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "newestBuild",
        headerName: "Newest build",
        type: "number",
        width: 140,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "newestAppVersion",
        headerName: "Newest version",
        width: 150,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "newestPlatform",
        headerName: "On",
        width: 90,
        align: "center",
        headerAlign: "center",
        renderCell: (p) =>
          p.value ? (
            p.value === "ios" ? (
              <PhoneIphoneIcon fontSize="small" />
            ) : (
              <AndroidIcon fontSize="small" />
            )
          ) : (
            "—"
          ),
      },
      {
        field: "newestModelName",
        headerName: "Model",
        flex: 1.3,
        minWidth: 180,
        renderCell: (p) => (
          <Stack sx={{ overflow: "hidden" }}>
            <Typography noWrap>{p.value || "—"}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {p.row.newestBrand || "—"} / {p.row.newestModelId || "—"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "hasPush",
        headerName: "Push Notification",
        width: 90,
        align: "center",
        headerAlign: "center",
        renderCell: (p) => (
          <Chip
            size="small"
            label={p.value ? "Yes" : "No"}
            color={p.value ? "success" : "default"}
          />
        ),
      },
      {
        field: "behindBy",
        headerName: "Behind",
        width: 90,
        type: "number",
        align: "center",
        headerAlign: "center",
      },
      {
        field: "lastSeenAt",
        headerName: "Last seen",
        flex: 1,
        minWidth: 180,
        valueGetter: (p) => p.row.lastSeenAt,
        renderCell: (p) => <Typography>{formatTime(p.value)}</Typography>,
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        align: "center",
        headerAlign: "center",
        sortable: true,
        renderCell: (p) => (
          <StatusPill
            status={p.row.status}
            newestBuild={Number(p.row.newestBuild || 0)}
            cfg={usersCfg}
            behindBy={p.row.behindBy}
          />
        ),
      },
      {
        field: "actions",
        headerName: "",
        width: 64,
        align: "center",
        headerAlign: "center",
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <Tooltip title="Xem thiết bị">
            <IconButton size="small" onClick={() => openDevices(p.row)}>
              <VisibilityIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [usersCfg]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <ToastContainer position="top-right" autoClose={2200} theme="colored" newestOnTop />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Quản trị phiên bản ứng dụng
        </Typography>

        {/* Tabs platform */}
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            aria-label="platform tabs"
            variant="fullWidth"
          >
            {PLATFORMS.map((p) => (
              <Tab key={p} value={p} label={p.toUpperCase()} />
            ))}
          </Tabs>
        </Paper>

        {/* Cấu hình phiên bản */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="latestVersion"
                value={latestVersion}
                onChange={(e) => setLatestVersion(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BoltIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                helperText="Version hiển thị (vd: 1.0.3)"
              />
              <TextField
                label="latestBuild"
                value={latestBuild}
                onChange={(e) => setLatestBuild(e.target.value.replace(/\D+/g, ""))}
                fullWidth
                type="number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BoltIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                helperText="Build khuyến nghị (iOS buildNumber, Android versionCode)"
              />
            </Stack>

            <TextField
              label="minSupportedBuild (force < giá trị này)"
              value={minSupportedBuild}
              onChange={(e) => setMinSupportedBuild(e.target.value.replace(/\D+/g, ""))}
              type="number"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SecurityIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              helperText="Bản thấp hơn sẽ bị chặn (HTTP 426)"
            />

            <TextField
              label="storeUrl"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              helperText="Link App Store / Play Store"
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="rollout percentage"
                value={rolloutPct}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setRolloutPct(n);
                }}
                type="number"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <PercentIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                helperText="Áp lực force theo % cohort (giảm rủi ro rollout)"
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="cohort-label">cohortKey</InputLabel>
                <Select
                  labelId="cohort-label"
                  label="cohortKey"
                  value={rolloutCohort}
                  onChange={(e) => setRolloutCohort(e.target.value)}
                >
                  <MenuItem value="deviceId">deviceId</MenuItem>
                  <MenuItem value="userId">userId</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <TextField
              label="blockedBuilds (comma-separated)"
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
              helperText="Kill-switch build lỗi, ví dụ: 101, 102, 103"
            />

            <TextField
              label="changelog"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              multiline
              minRows={3}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <NotesIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {behindHint ? <Alert severity={behindHint.type}>{behindHint.text}</Alert> : null}

            <Divider />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleReload}
                disabled={q.isFetching}
              >
                Tải lại
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={onSave}
                disabled={saveState.isLoading}
              >
                Lưu cấu hình ({tab.toUpperCase()})
              </Button>
            </Stack>

            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Tip: iOS dùng <b>ios.buildNumber</b> (chuỗi số), Android dùng{" "}
              <b>android.versionCode</b> (số). App client gửi <code>X-Build</code> để server so với{" "}
              <code>minSupportedBuild</code>.
            </Typography>
          </Stack>
        </Paper>

        {/* ==== THỐNG KÊ & DANH SÁCH USER ==== */}
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" fontWeight={800} gutterBottom>
            Thống kê & người dùng theo phiên bản
          </Typography>

          {/* Bộ lọc */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="flt-type-label">Loại</InputLabel>
              <Select
                labelId="flt-type-label"
                label="Loại"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="all">Tất cả</MenuItem>
                <MenuItem value="soft">Chậm (soft)</MenuItem>
                <MenuItem value="force">Bị chặn (force)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Tìm theo tên/email / model / build / version"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              fullWidth
            />
            <TextField
              label="Giới hạn"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value || 50)))}
              sx={{ maxWidth: 160 }}
            />

            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  statsQ.refetch && statsQ.refetch();
                  usersQ.refetch && usersQ.refetch();
                }}
              >
                Làm mới
              </Button>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch
              checked={includeDevices}
              onChange={(e) => setIncludeDevices(e.target.checked)}
            />
            <Typography variant="body2">Tải kèm danh sách thiết bị</Typography>
          </Stack>

          {/* Cards thống kê */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Thiết bị
              </Typography>
              <Stack direction="row" alignItems="center" gap={1}>
                <DevicesIcon fontSize="small" />
                <Typography variant="h6">
                  {statsQ.data?.summary?.totalDevices ?? (statsQ.isFetching ? "…" : "0")}
                </Typography>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Người dùng
              </Typography>
              <Stack direction="row" alignItems="center" gap={1}>
                <PeopleIcon fontSize="small" />
                <Typography variant="h6">
                  {statsQ.data?.summary?.uniqueUsersCount ?? (statsQ.isFetching ? "…" : "0")}
                </Typography>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Chậm (soft)
              </Typography>
              <Stack direction="row" alignItems="center" gap={1}>
                <ReportProblemIcon fontSize="small" />
                <Typography variant="h6">
                  {statsQ.data?.summary?.behind ?? (statsQ.isFetching ? "…" : "0")}
                </Typography>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Bị chặn (force)
              </Typography>
              <Stack direction="row" alignItems="center" gap={1}>
                <BlockIcon fontSize="small" />
                <Typography variant="h6">
                  {statsQ.data?.summary?.force ?? (statsQ.isFetching ? "…" : "0")}
                </Typography>
              </Stack>
            </Paper>
          </Stack>

          {/* Breakdown theo platform + top lists */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Phân bổ nền tảng
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                  icon={<PhoneIphoneIcon />}
                  label={`iOS: ${statsQ.data?.platformBreakdown?.ios ?? 0}`}
                  variant="outlined"
                  size="small"
                />
                <Chip
                  icon={<AndroidIcon />}
                  label={`Android: ${statsQ.data?.platformBreakdown?.android ?? 0}`}
                  variant="outlined"
                  size="small"
                />
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Top Builds
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(statsQ.data?.topBuilds ?? []).map((b) => (
                  <Chip
                    key={b.buildNumber}
                    icon={<MemoryIcon />}
                    label={`${b.buildNumber} (${b.count})`}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Top App Versions
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(statsQ.data?.topAppVersions ?? []).map((v) => (
                  <Chip
                    key={v.appVersion}
                    icon={<InfoOutlinedIcon />}
                    label={`${v.appVersion} (${v.count})`}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Paper>
          </Stack>

          {/* DataGrid danh sách user */}
          <div style={{ width: "100%" }}>
            <DataGrid
              autoHeight
              rows={users}
              getRowId={(r) => r.userId || r.userEmail || `${r.userName}-${r.lastSeenAt}`}
              columns={columns}
              loading={usersQ.isFetching}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: Math.min(limit, 100), page: 0 } },
                density: "compact",
                sorting: {
                  sortModel: [
                    { field: "status", sort: "asc" },
                    { field: "lastSeenAt", sort: "desc" },
                  ],
                },
              }}
              slots={{ toolbar: GridToolbar }}
              slotProps={{
                toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
              }}
            />
          </div>

          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
            Config hiện tại: latestBuild = <b>{usersCfg.latestBuild ?? 0}</b>, minSupportedBuild ={" "}
            <b>{usersCfg.minSupportedBuild ?? 0}</b>. Trạng thái dựa trên <i>newestBuild</i> & logic
            server (<i>blocked/force/soft/ok</i>).
          </Typography>
        </Paper>
      </Container>

      {/* Drawer hiển thị danh sách thiết bị */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDevices}
        PaperProps={{ sx: { width: 420 } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={800}>
              Thiết bị của {drawerUser?.userName || "—"}
            </Typography>
            <Tooltip title="Mở hồ sơ (nếu có)">
              <span>
                <IconButton size="small" disabled>
                  <OpenInNewIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {drawerUser?.devices?.length ? (
            <List dense>
              {drawerUser.devices.map((d, idx) => (
                <ListItem key={`${d.deviceId}-${idx}`} alignItems="flex-start" sx={{ mb: 1 }}>
                  <ListItemIcon>
                    {d.platform === "ios" ? <PhoneIphoneIcon /> : <AndroidIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={700}>
                          {d.deviceModelName || d.deviceModel || "—"}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<UsbIcon />}
                          label={d.deviceId || "—"}
                        />
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.2} sx={{ mt: 0.5 }}>
                        <KeyValue k="Brand" v={d.deviceBrand || "—"} />
                        <KeyValue k="Model ID" v={d.deviceModelId || "—"} />
                        <KeyValue
                          k="App Version"
                          v={`${d.appVersion || "0.0.0"} (${d.buildNumber ?? 0})`}
                        />
                        <KeyValue k="First seen" v={formatTime(d.firstSeenAt)} />
                        <KeyValue k="Last seen" v={formatTime(d.lastSeenAt)} />
                        <KeyValue k="Push token" v={d.pushToken ? "Yes" : "No"} />
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              Không có dữ liệu thiết bị. Hãy bật “Tải kèm danh sách thiết bị” hoặc chọn user khác.
            </Alert>
          )}
        </Box>
      </Drawer>
    </DashboardLayout>
  );
}

KeyValue.propTypes = {
  k: PropTypes.node.isRequired, // nhãn bên trái
  v: PropTypes.node, // giá trị bên phải (string/number/element đều OK)
  mono: PropTypes.bool, // hiển thị font monospace cho v
};

KeyValue.defaultProps = {
  v: "—",
  mono: false,
};
