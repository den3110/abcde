import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Stack,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  LinearProgress,
  Chip,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  TextField,
  Divider,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

import RefreshIcon from "@mui/icons-material/Refresh";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import RouterIcon from "@mui/icons-material/Router";
import TerminalIcon from "@mui/icons-material/Terminal";
import DescriptionIcon from "@mui/icons-material/Description";
import LanIcon from "@mui/icons-material/Lan";
import AssessmentIcon from "@mui/icons-material/Assessment";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  useGetSystemSummaryQuery,
  useGetDiskUsageQuery,
  useGetTopProcessesQuery,
  useGetServicesStatusQuery,
  useGetNetworkSummaryQuery,
  useGetOpenPortsQuery,
  useGetLogTypesQuery,
  useGetLogTailQuery,
  useGetSafeCommandsQuery,
  useExecSafeCommandMutation,
  useKillProcessMutation,
  useServiceActionMutation,
} from "slices/adminSystemApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";
const TAB_KEYS = ["overview", "processes", "network", "ports", "logs", "terminal"];

const bytesToGB = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(2);

const formatPercent = (val) => (typeof val === "number" ? `${val.toFixed(1)}%` : "-");

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatUptime = (seconds) => {
  if (!seconds) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  if (!parts.length) parts.push(`${Math.floor(seconds)}s`);
  return parts.join(" ");
};

const statusColor = (running) => (running ? "success" : "error");

/* ======================= DataGrid Columns base ======================= */

// Disk usage
const diskColumns = [
  {
    field: "mountpoint",
    headerName: "Mount",
    flex: 1,
    minWidth: 140,
    renderCell: (params) => (
      <Tooltip title={params.value || ""}>
        <Typography
          variant="body2"
          sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {params.value}
        </Typography>
      </Tooltip>
    ),
  },
  {
    field: "device",
    headerName: "Device",
    flex: 1,
    minWidth: 140,
    renderCell: (params) => (
      <Tooltip title={params.value || ""}>
        <Typography
          variant="body2"
          sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {params.value}
        </Typography>
      </Tooltip>
    ),
  },
  {
    field: "fstype",
    headerName: "FS",
    width: 80,
  },
  {
    field: "total",
    headerName: "Size",
    type: "number",
    minWidth: 120,
    valueFormatter: (params) => formatBytes(Number(params.value || 0)),
  },
  {
    field: "used",
    headerName: "Used",
    type: "number",
    minWidth: 120,
    valueFormatter: (params) => formatBytes(Number(params.value || 0)),
  },
  {
    field: "usedPercent",
    headerName: "Used %",
    type: "number",
    minWidth: 160,
    renderCell: (params) => {
      const val = Number(params.value || 0);
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
          <Typography variant="body2" sx={{ minWidth: 40 }}>
            {formatPercent(val)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(val, 100)}
            color={val > 90 ? "error" : "primary"}
            sx={{ flex: 1, height: 6, borderRadius: 1 }}
          />
        </Box>
      );
    },
    sortComparator: (v1, v2) => Number(v1 || 0) - Number(v2 || 0),
  },
];

// Processes (base)
const baseProcessColumns = [
  { field: "pid", headerName: "PID", width: 90 },
  { field: "name", headerName: "Name", flex: 1, minWidth: 140 },
  { field: "user", headerName: "User", width: 120 },
  {
    field: "cpuPercent",
    headerName: "CPU %",
    type: "number",
    width: 110,
    valueFormatter: (params) =>
      params.value || params.value === 0 ? Number(params.value).toFixed(1) : "0.0",
  },
  {
    field: "memPercent",
    headerName: "RAM %",
    type: "number",
    width: 110,
    valueFormatter: (params) =>
      params.value || params.value === 0 ? Number(params.value).toFixed(1) : "0.0",
  },
  {
    field: "memRss",
    headerName: "RSS",
    width: 140,
    valueFormatter: (params) => formatBytes(Number(params.value || 0)),
  },
  {
    field: "command",
    headerName: "Command",
    flex: 2,
    minWidth: 260,
    renderCell: (params) => (
      <Tooltip title={params.value || ""}>
        <Typography
          variant="body2"
          sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {params.value || "-"}
        </Typography>
      </Tooltip>
    ),
  },
];

// Services (base)
const baseServicesColumns = [
  {
    field: "name",
    headerName: "Service",
    flex: 1,
    minWidth: 160,
  },
  {
    field: "running",
    headerName: "Status",
    width: 120,
    sortable: false,
    renderCell: (params) => (
      <Chip
        size="small"
        label={params.value ? "running" : "stopped"}
        color={params.value ? "success" : "error"}
      />
    ),
  },
  {
    field: "CPUPercent",
    headerName: "CPU %",
    type: "number",
    width: 120,
    valueFormatter: (params) =>
      params.value || params.value === 0 ? Number(params.value).toFixed(1) : "0.0",
  },
  {
    field: "MemRSS",
    headerName: "RAM RSS",
    width: 160,
    valueFormatter: (params) => formatBytes(Number(params.value || 0)),
  },
];

// Network
const networkColumns = [
  {
    field: "name",
    headerName: "Name",
    width: 140,
  },
  {
    field: "ipv4",
    headerName: "IPv4",
    width: 160,
  },
  {
    field: "ipv6",
    headerName: "IPv6",
    flex: 1,
    minWidth: 220,
  },
  {
    field: "hardwareAddr",
    headerName: "MAC",
    width: 160,
  },
  {
    field: "bytesRecv",
    headerName: "Bytes RX",
    type: "number",
    width: 150,
    valueFormatter: (params) => formatBytes(Number(params.value || 0)),
  },
  {
    field: "bytesSent",
    headerName: "Bytes TX",
    type: "number",
    width: 150,
    valueFormatter: (params) => formatBytes(Number(params.value || 0)),
  },
  {
    field: "packetsRecv",
    headerName: "Packets RX",
    type: "number",
    width: 140,
  },
  {
    field: "packetsSent",
    headerName: "Packets TX",
    type: "number",
    width: 140,
  },
];

// Sparkline đơn giản (CPU/RAM history)
const MiniSparkline = ({ data, max = 100 }) => {
  if (!data || data.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Không có history.
      </Typography>
    );
  }
  const values = data.map((d) => (typeof d === "number" ? d : d.value));
  const maxVal = Math.max(max, ...values, 1);
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.3, height: 40, mt: 1 }}>
      {values.map((v, idx) => (
        <Box
          key={idx}
          sx={{
            width: 3,
            borderRadius: 1,
            height: `${(v / maxVal) * 100}%`,
            bgcolor: v > 90 ? "error.main" : v > 70 ? "warning.main" : "primary.main",
            opacity: 0.9,
          }}
        />
      ))}
    </Box>
  );
};

// Highlight text trong log
const renderHighlightedText = (text, query) => {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts = [];
  let start = 0;
  let index = lower.indexOf(q, start);
  if (index === -1) return text;
  let key = 0;
  while (index !== -1) {
    if (index > start) {
      parts.push(text.slice(start, index));
    }
    parts.push(
      <Box key={`h-${key++}`} component="span" sx={{ bgcolor: "warning.main", color: "black" }}>
        {text.slice(index, index + query.length)}
      </Box>
    );
    start = index + query.length;
    index = lower.indexOf(q, start);
  }
  if (start < text.length) {
    parts.push(text.slice(start));
  }
  return parts;
};

const AdminSystemPage = () => {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [tab, setTab] = useState("overview");

  // === STATE cho processes tab ===
  const [procSortBy, setProcSortBy] = useState("cpu");
  const [procLimit, setProcLimit] = useState(20);
  const [procSearch, setProcSearch] = useState("");

  // === STATE cho logs tab ===
  const [selectedLogType, setSelectedLogType] = useState("");
  const [logLines, setLogLines] = useState(300);
  const [logAutoRefresh, setLogAutoRefresh] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logShowOnlyMatches, setLogShowOnlyMatches] = useState(false);

  // === STATE cho terminal tab ===
  const [selectedCmdKey, setSelectedCmdKey] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalError, setTerminalError] = useState("");
  const [terminalAutoRun, setTerminalAutoRun] = useState(false);
  const [terminalIntervalSec, setTerminalIntervalSec] = useState(30);

  // === STATE cho network & ports ===
  const [networkOnlyWithIP, setNetworkOnlyWithIP] = useState(true);
  const [portsFilter, setPortsFilter] = useState("");

  // History CPU/RAM
  const [cpuHistory, setCpuHistory] = useState([]);
  const [memHistory, setMemHistory] = useState([]);

  // Snackbar cho các action
  const [snackbar, setSnackbar] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const showSnackbar = useCallback((severity, message) => {
    setSnackbar({ open: true, severity, message });
  }, []);

  const handleCloseSnackbar = useCallback((event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // ======== QUERIES ========

  // Overview: summary + disk + services
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useGetSystemSummaryQuery(undefined, {
    pollingInterval: tab === "overview" ? 10000 : 0,
  });

  const {
    data: disk,
    isLoading: diskLoading,
    refetch: refetchDisk,
  } = useGetDiskUsageQuery(undefined, {
    pollingInterval: tab === "overview" ? 20000 : 0,
  });

  const {
    data: services,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useGetServicesStatusQuery(undefined, {
    pollingInterval: tab === "overview" || tab === "processes" ? 20000 : 0,
  });

  // Processes tab
  const {
    data: processes,
    isLoading: processesLoading,
    refetch: refetchProcesses,
  } = useGetTopProcessesQuery(
    { sortBy: procSortBy, limit: procLimit },
    {
      pollingInterval: tab === "processes" ? 10000 : 0,
    }
  );

  // Network tab
  const {
    data: network,
    isLoading: networkLoading,
    refetch: refetchNetwork,
  } = useGetNetworkSummaryQuery(undefined, {
    pollingInterval: tab === "network" ? 10000 : 0,
  });

  // Ports tab
  const {
    data: ports,
    isLoading: portsLoading,
    refetch: refetchPorts,
  } = useGetOpenPortsQuery(undefined, {
    pollingInterval: tab === "ports" ? 20000 : 0,
  });

  // Logs tab
  const {
    data: logTypes,
    isLoading: logTypesLoading,
    refetch: refetchLogTypes,
  } = useGetLogTypesQuery();

  const {
    data: logTail,
    isLoading: logTailLoading,
    refetch: refetchLogTail,
  } = useGetLogTailQuery(
    { type: selectedLogType, lines: logLines },
    {
      skip: !selectedLogType,
      pollingInterval: tab === "logs" && logAutoRefresh && selectedLogType ? 5000 : 0,
    }
  );

  // Terminal tab
  const {
    data: safeCommands,
    isLoading: commandsLoading,
    refetch: refetchCommands,
  } = useGetSafeCommandsQuery();

  const [execSafeCommand, { isLoading: execLoading }] = useExecSafeCommandMutation();

  // New mutations
  const [killProcess, { isLoading: killLoading }] = useKillProcessMutation();
  const [serviceAction, { isLoading: serviceActionLoading }] = useServiceActionMutation();

  // Chọn default log type & cmd khi có data
  useEffect(() => {
    if (!selectedLogType && logTypes && logTypes.length > 0) {
      setSelectedLogType(logTypes[0].key);
    }
  }, [logTypes, selectedLogType]);

  useEffect(() => {
    if (!selectedCmdKey && safeCommands && safeCommands.length > 0) {
      setSelectedCmdKey(safeCommands[0].key);
    }
  }, [safeCommands, selectedCmdKey]);

  // Cập nhật CPU/RAM history theo summary
  useEffect(() => {
    if (!summary) return;
    const cpuUsage = summary?.cpu?.usagePercent;
    const memUsage = summary?.memory?.usedPercent;
    const ts = Date.now();

    if (typeof cpuUsage === "number") {
      setCpuHistory((prev) => {
        const next = [...prev, { ts, value: cpuUsage }];
        return next.slice(-60); // giữ ~60 sample gần nhất
      });
    }
    if (typeof memUsage === "number") {
      setMemHistory((prev) => {
        const next = [...prev, { ts, value: memUsage }];
        return next.slice(-60);
      });
    }
  }, [summary]);

  const runSafeCommand = useCallback(async () => {
    if (!selectedCmdKey) return;
    try {
      setTerminalError("");
      setTerminalOutput("");
      const result = await execSafeCommand({
        cmdKey: selectedCmdKey,
      }).unwrap();
      let out = result.output || "";
      if (!out.trim()) {
        out = "(no output)";
      }
      const errText = result.error ? `\n[error]\n${result.error}` : "";
      setTerminalOutput(out + errText);
    } catch (err) {
      const msg = err?.data?.error || err?.error || "Có lỗi khi chạy command";
      setTerminalError(msg);
      showSnackbar("error", msg);
    }
  }, [selectedCmdKey, execSafeCommand, showSnackbar]);

  const handleRunCommand = () => {
    runSafeCommand();
  };

  // Auto-run terminal command
  useEffect(() => {
    if (!terminalAutoRun || !selectedCmdKey) return;
    // chạy ngay lần đầu
    runSafeCommand();
    const id = setInterval(runSafeCommand, terminalIntervalSec * 1000);
    return () => clearInterval(id);
  }, [terminalAutoRun, terminalIntervalSec, selectedCmdKey, runSafeCommand]);

  const handleKillProcess = useCallback(
    async (row) => {
      if (!row?.pid) return;
      const ok = window.confirm(`Kill process PID ${row.pid} (${row.name || "-"})?`);
      if (!ok) return;
      try {
        await killProcess({ pid: row.pid }).unwrap();
        showSnackbar("success", `Đã gửi lệnh kill PID ${row.pid}.`);
        refetchProcesses();
      } catch (err) {
        const msg = err?.data?.error || err?.error || "Kill process thất bại";
        showSnackbar("error", msg);
      }
    },
    [killProcess, refetchProcesses, showSnackbar]
  );

  const handleServiceRestart = useCallback(
    async (row) => {
      if (!row?.name) return;
      const ok = window.confirm(`Restart service ${row.name}?`);
      if (!ok) return;
      try {
        await serviceAction({ name: row.name, action: "restart" }).unwrap();
        showSnackbar("success", `Đã gửi lệnh restart ${row.name}.`);
        refetchServices();
      } catch (err) {
        const msg = err?.data?.error || err?.error || "Restart service thất bại";
        showSnackbar("error", msg);
      }
    },
    [serviceAction, refetchServices, showSnackbar]
  );

  const handleCopyOutput = useCallback(() => {
    if (!terminalOutput) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(terminalOutput)
        .then(() => {
          showSnackbar("success", "Đã copy output vào clipboard.");
        })
        .catch(() => {
          showSnackbar("error", "Copy clipboard thất bại.");
        });
    }
  }, [terminalOutput, showSnackbar]);

  const handleChangeTab = (event, newValue) => {
    setTab(newValue);
  };

  // Columns có thêm action (kill / restart)
  const processColumns = useMemo(
    () => [
      ...baseProcessColumns,
      {
        field: "actions",
        headerName: "Actions",
        width: 110,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Tooltip title="Kill process (SIGTERM)">
            <span>
              <IconButton size="small" color="error" onClick={() => handleKillProcess(params.row)}>
                <HighlightOffIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
    ],
    [handleKillProcess]
  );

  const servicesColumns = useMemo(
    () => [
      ...baseServicesColumns,
      {
        field: "actions",
        headerName: "Actions",
        width: 130,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Restart service">
              <span>
                <IconButton size="small" onClick={() => handleServiceRestart(params.row)}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [handleServiceRestart]
  );

  // ====== RENDER TABS ======

  const renderOverviewTab = () => {
    const mem = summary?.memory;
    const memPercent = mem?.usedPercent || 0;

    const diskRows =
      disk?.map((d, idx) => ({
        id: `${d.device}-${d.mountpoint}-${idx}`,
        ...d,
      })) || [];

    return (
      <Stack spacing={2}>
        <Stack direction={isMdUp ? "row" : "column"} spacing={2} alignItems="stretch">
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AssessmentIcon fontSize="small" />
                  <Typography variant="h6">System</Typography>
                </Stack>
                <IconButton size="small" onClick={() => refetchSummary()}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Stack>

              {summaryLoading && !summary ? (
                <LinearProgress />
              ) : (
                <>
                  <Typography variant="body2">
                    Host: <b>{summary?.hostname || "-"}</b>
                  </Typography>
                  <Typography variant="body2">
                    OS: {summary?.platform} {summary?.platformVersion}
                  </Typography>
                  <Typography variant="body2">Kernel: {summary?.kernelVersion}</Typography>
                  <Typography variant="body2">
                    Uptime: {formatUptime(summary?.uptimeSeconds)}
                  </Typography>
                  <Box mt={1.5}>
                    <Typography variant="body2" gutterBottom>
                      CPU: {summary?.cpu?.brand} (
                      {summary?.cpu?.physicalCores || summary?.cpu?.cores} cores)
                    </Typography>
                    <Typography variant="body2">
                      Load avg (1/5/15):{" "}
                      {summary?.loadAvg
                        ? `${summary.loadAvg.load1.toFixed(2)} / ${summary.loadAvg.load5.toFixed(
                            2
                          )} / ${summary.loadAvg.load15.toFixed(2)}`
                        : "-"}
                    </Typography>
                    <Typography variant="body2">
                      CPU usage: {formatPercent(summary?.cpu?.usagePercent)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      CPU history (last ~{cpuHistory.length} samples)
                    </Typography>
                    <MiniSparkline data={cpuHistory} max={100} />
                  </Box>
                </>
              )}
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MemoryIcon fontSize="small" />
                  <Typography variant="h6">Memory</Typography>
                </Stack>
                <IconButton size="small" onClick={() => refetchSummary()}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Stack>

              {summaryLoading && !summary ? (
                <LinearProgress />
              ) : mem ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, memPercent)}
                    sx={{ mb: 1.5 }}
                  />
                  <Typography variant="body2">
                    {bytesToGB(mem.used)} GB / {bytesToGB(mem.total)} GB ({memPercent.toFixed(1)}%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    RAM history
                  </Typography>
                  <MiniSparkline data={memHistory} max={100} />
                </>
              ) : (
                <Typography variant="body2">Không có dữ liệu RAM.</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Stack direction={isMdUp ? "row" : "column"} spacing={2} alignItems="stretch">
          {/* Disk - DataGrid */}
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StorageIcon fontSize="small" />
                  <Typography variant="h6">Disk usage</Typography>
                </Stack>
                <IconButton size="small" onClick={() => refetchDisk()}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Stack>

              {diskLoading && !disk ? (
                <LinearProgress />
              ) : !disk || disk.length === 0 ? (
                <Typography variant="body2">Không có dữ liệu disk.</Typography>
              ) : (
                <Box sx={{ width: "100%" }}>
                  <DataGrid
                    autoHeight
                    density="compact"
                    rows={diskRows}
                    columns={diskColumns}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 5, page: 0 } },
                    }}
                    disableRowSelectionOnClick
                    loading={diskLoading}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Services quick status */}
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon fontSize="small" />
                  <Typography variant="h6">Services</Typography>
                </Stack>
                <IconButton size="small" onClick={() => refetchServices()}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Stack>

              {servicesLoading && !services ? (
                <LinearProgress />
              ) : !services || services.length === 0 ? (
                <Typography variant="body2">
                  Không thấy service nào trong danh sách theo dõi.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {services.map((svc) => (
                    <Stack
                      key={svc.name}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="body2">{svc.name}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={svc.running ? "running" : "stopped"}
                          size="small"
                          color={statusColor(svc.running)}
                        />
                        <Typography variant="caption" color="text.secondary">
                          CPU {svc.CPUPercent ? svc.CPUPercent.toFixed(1) : "0"}% • RAM{" "}
                          {formatBytes(svc.MemRSS)}
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Stack>
    );
  };

  const renderProcessesTab = () => {
    const processRows =
      processes?.map((p) => ({
        id: p.pid,
        ...p,
      })) || [];

    const filteredProcessRows =
      procSearch.trim().length > 0
        ? processRows.filter((row) => {
            const q = procSearch.toLowerCase();
            return (
              String(row.pid).includes(q) ||
              (row.name && row.name.toLowerCase().includes(q)) ||
              (row.user && row.user.toLowerCase().includes(q)) ||
              (row.command && row.command.toLowerCase().includes(q))
            );
          })
        : processRows;

    const servicesRows =
      services?.map((svc, idx) => ({
        id: svc.name || idx,
        ...svc,
      })) || [];

    // Aggregation CPU/RAM theo user
    const userAggMap = {};
    processRows.forEach((p) => {
      const user = p.user || "unknown";
      if (!userAggMap[user]) {
        userAggMap[user] = { cpu: 0, mem: 0, count: 0 };
      }
      userAggMap[user].cpu += Number(p.cpuPercent || 0);
      userAggMap[user].mem += Number(p.memRss || 0);
      userAggMap[user].count += 1;
    });

    const userAgg = Object.entries(userAggMap).map(([user, v]) => ({
      user,
      ...v,
    }));
    userAgg.sort((a, b) => b.cpu - a.cpu);
    const topUserAgg = userAgg.slice(0, 5);
    const maxUserCpu = topUserAgg.reduce((m, u) => Math.max(m, u.cpu), 0) || 1;

    return (
      <Stack spacing={2}>
        <Stack
          direction={isMdUp ? "row" : "column"}
          spacing={2}
          alignItems={isMdUp ? "center" : "flex-start"}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="h6">Top processes</Typography>
            <Select size="small" value={procSortBy} onChange={(e) => setProcSortBy(e.target.value)}>
              <MenuItem value="cpu">Sort by CPU%</MenuItem>
              <MenuItem value="mem">Sort by RAM</MenuItem>
            </Select>
            <TextField
              size="small"
              label="Limit"
              type="number"
              value={procLimit}
              onChange={(e) =>
                setProcLimit(Math.max(5, Math.min(100, Number(e.target.value) || 10)))
              }
              sx={{ width: 100 }}
            />
            <TextField
              size="small"
              label="Search"
              placeholder="PID / name / user / command"
              value={procSearch}
              onChange={(e) => setProcSearch(e.target.value)}
              sx={{ minWidth: 220 }}
            />
          </Stack>
          <IconButton size="small" onClick={() => refetchProcesses()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>

        {processesLoading && !processes ? (
          <LinearProgress />
        ) : !processes || processes.length === 0 ? (
          <Typography variant="body2">Không có dữ liệu process.</Typography>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ width: "100%" }}>
              <DataGrid
                autoHeight
                density="compact"
                rows={filteredProcessRows}
                columns={processColumns}
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10, page: 0 } },
                }}
                disableRowSelectionOnClick
                loading={processesLoading || killLoading}
              />
            </Box>

            {topUserAgg.length > 0 && (
              <Card sx={{ mt: 1 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    CPU / RAM theo user (top {topUserAgg.length})
                  </Typography>
                  <Stack spacing={1.2}>
                    {topUserAgg.map((u) => (
                      <Box key={u.user}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2">{u.user}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            CPU {u.cpu.toFixed(1)} • RAM {formatBytes(u.mem)} • {u.count} proc
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, (u.cpu / maxUserCpu) * 100)}
                          sx={{ mt: 0.5, height: 6, borderRadius: 1 }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Services dưới tab này dùng DataGrid luôn */}
        <Typography variant="h6">Services status</Typography>
        {servicesLoading && !services ? (
          <LinearProgress />
        ) : !services || services.length === 0 ? (
          <Typography variant="body2">Không có dữ liệu service.</Typography>
        ) : (
          <Box sx={{ width: "100%" }}>
            <DataGrid
              autoHeight
              density="compact"
              rows={servicesRows}
              columns={servicesColumns}
              pageSizeOptions={[5, 10, 25]}
              initialState={{
                pagination: { paginationModel: { pageSize: 5, page: 0 } },
              }}
              disableRowSelectionOnClick
              loading={servicesLoading || serviceActionLoading}
            />
          </Box>
        )}
      </Stack>
    );
  };

  const renderNetworkTab = () => {
    let networkRows =
      network?.map((iface, idx) => ({
        id: iface.name || idx,
        ...iface,
      })) || [];

    if (networkOnlyWithIP) {
      networkRows = networkRows.filter(
        (iface) =>
          (iface.ipv4 && String(iface.ipv4).trim().length > 0) ||
          (iface.ipv6 && String(iface.ipv6).trim().length > 0)
      );
    }

    return (
      <Stack spacing={2}>
        <Stack
          direction={isMdUp ? "row" : "column"}
          justifyContent="space-between"
          alignItems={isMdUp ? "center" : "flex-start"}
          spacing={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <RouterIcon fontSize="small" />
            <Typography variant="h6">Network interfaces</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={networkOnlyWithIP}
                  onChange={(e) => setNetworkOnlyWithIP(e.target.checked)}
                />
              }
              label="Only interfaces with IP"
            />
            <IconButton size="small" onClick={() => refetchNetwork()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {networkLoading && !network ? (
          <LinearProgress />
        ) : !network || network.length === 0 ? (
          <Typography variant="body2">Không có dữ liệu network.</Typography>
        ) : (
          <Box sx={{ width: "100%" }}>
            <DataGrid
              autoHeight
              density="compact"
              rows={networkRows}
              columns={networkColumns}
              pageSizeOptions={[5, 10, 25]}
              initialState={{
                pagination: { paginationModel: { pageSize: 5, page: 0 } },
              }}
              disableRowSelectionOnClick
              loading={networkLoading}
            />
          </Box>
        )}
      </Stack>
    );
  };

  const renderPortsTab = () => {
    const outputText = ports?.output || "";
    const displayText =
      portsFilter.trim().length > 0 && outputText
        ? outputText
            .split("\n")
            .filter((line) => line.toLowerCase().includes(portsFilter.toLowerCase()))
            .join("\n")
        : outputText;

    return (
      <Stack spacing={2}>
        <Stack
          direction={isMdUp ? "row" : "column"}
          justifyContent="space-between"
          alignItems={isMdUp ? "center" : "flex-start"}
          spacing={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <LanIcon fontSize="small" />
            <Typography variant="h6">Open ports (ss / netstat)</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              label="Filter"
              placeholder="port / addr / process"
              value={portsFilter}
              onChange={(e) => setPortsFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            />
            <IconButton size="small" onClick={() => refetchPorts()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {portsLoading && !ports ? (
          <LinearProgress />
        ) : !ports ? (
          <Typography variant="body2">Không có dữ liệu ports.</Typography>
        ) : (
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: "background.default",
              borderRadius: 1,
              maxHeight: 500,
              overflow: "auto",
              fontSize: 13,
              fontFamily: "Roboto Mono, monospace",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Tool: {ports.tool}
            </Typography>
            {"\n\n"}
            {displayText}
          </Box>
        )}
      </Stack>
    );
  };

  const renderLogsTab = () => {
    return (
      <Stack spacing={2}>
        <Stack
          direction={isMdUp ? "row" : "column"}
          spacing={2}
          alignItems={isMdUp ? "center" : "flex-start"}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <DescriptionIcon fontSize="small" />
              <Typography variant="h6">Logs</Typography>
            </Stack>

            <Select
              size="small"
              value={selectedLogType}
              onChange={(e) => setSelectedLogType(e.target.value)}
              disabled={logTypesLoading || !logTypes}
              sx={{ minWidth: 220 }}
            >
              {logTypes?.map((lt) => (
                <MenuItem key={lt.key} value={lt.key}>
                  {lt.label}
                </MenuItem>
              ))}
            </Select>

            <Box sx={{ width: 220, px: 1 }}>
              <Typography variant="caption">Lines: {logLines}</Typography>
              <Slider
                size="small"
                min={100}
                max={2000}
                step={100}
                value={logLines}
                onChange={(_, val) => setLogLines(val)}
              />
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={logAutoRefresh}
                  onChange={(e) => setLogAutoRefresh(e.target.checked)}
                />
              }
              label="Auto refresh 5s"
            />
            <TextField
              size="small"
              label="Search"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              sx={{ minWidth: 160 }}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={logShowOnlyMatches}
                  onChange={(e) => setLogShowOnlyMatches(e.target.checked)}
                  disabled={!logSearch}
                />
              }
              label="Only matches"
            />
            <Tooltip title="Refresh log">
              <span>
                <IconButton
                  size="small"
                  onClick={() => refetchLogTail()}
                  disabled={!selectedLogType}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {logTailLoading && !logTail ? (
          <LinearProgress />
        ) : !selectedLogType ? (
          <Typography variant="body2">Chọn một log để xem.</Typography>
        ) : !logTail ? (
          <Typography variant="body2">Không đọc được log.</Typography>
        ) : (
          (() => {
            const rawText = logTail.text || "";
            const lines = rawText.split("\n");
            const q = logSearch.trim().toLowerCase();
            const filteredLines =
              q && logShowOnlyMatches ? lines.filter((ln) => ln.toLowerCase().includes(q)) : lines;

            return (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "background.default",
                  borderRadius: 1,
                  maxHeight: 550,
                  overflow: "auto",
                  fontSize: 13,
                  fontFamily: "Roboto Mono, monospace",
                  whiteSpace: "pre",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {logTail.label} — {logTail.path} (last {logTail.lines} lines)
                </Typography>
                {"\n\n"}
                {filteredLines.map((line, idx) => (
                  <Box component="span" key={idx}>
                    {renderHighlightedText(line, logSearch)}
                    {"\n"}
                  </Box>
                ))}
              </Box>
            );
          })()
        )}
      </Stack>
    );
  };

  const renderTerminalTab = () => {
    return (
      <Stack spacing={2}>
        <Stack
          direction={isMdUp ? "row" : "column"}
          spacing={2}
          justifyContent="space-between"
          alignItems={isMdUp ? "center" : "flex-start"}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TerminalIcon fontSize="small" />
            <Typography variant="h6">Terminal (safe commands)</Typography>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Select
              size="small"
              value={selectedCmdKey}
              onChange={(e) => setSelectedCmdKey(e.target.value)}
              disabled={commandsLoading || !safeCommands}
              sx={{ minWidth: 260 }}
            >
              {safeCommands?.map((cmd) => (
                <MenuItem key={cmd.key} value={cmd.key}>
                  {cmd.label}
                </MenuItem>
              ))}
            </Select>

            <Button
              variant="contained"
              size="small"
              onClick={handleRunCommand}
              disabled={!selectedCmdKey || execLoading}
            >
              {execLoading ? "Running..." : "Run"}
            </Button>
            <IconButton
              size="small"
              onClick={() => {
                setTerminalOutput("");
                setTerminalError("");
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <Tooltip title="Copy output">
              <span>
                <IconButton size="small" onClick={handleCopyOutput} disabled={!terminalOutput}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={terminalAutoRun}
                  onChange={(e) => setTerminalAutoRun(e.target.checked)}
                />
              }
              label="Auto run"
            />
            <TextField
              size="small"
              label="Interval (s)"
              type="number"
              value={terminalIntervalSec}
              onChange={(e) =>
                setTerminalIntervalSec(Math.max(5, Math.min(3600, Number(e.target.value) || 30)))
              }
              sx={{ width: 130 }}
              disabled={!terminalAutoRun}
            />
          </Stack>
        </Stack>

        {terminalError && (
          <Typography variant="body2" color="error" sx={{ whiteSpace: "pre-wrap" }}>
            {terminalError}
          </Typography>
        )}

        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: "background.default",
            borderRadius: 1,
            minHeight: 280,
            maxHeight: 550,
            overflow: "auto",
            fontSize: 13,
            fontFamily: "Roboto Mono, monospace",
          }}
        >
          {execLoading && !terminalOutput ? "Running..." : terminalOutput || "No output yet."}
        </Box>
      </Stack>
    );
  };

  // ====== MAIN RENDER ======

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <AssessmentIcon />
          <Typography variant="h5" fontWeight={600}>
            Server Monitor
          </Typography>
        </Stack>

        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          <Tab
            label="Overview"
            value="overview"
            icon={<AssessmentIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Processes & Services"
            value="processes"
            icon={<MemoryIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Network"
            value="network"
            icon={<RouterIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Ports"
            value="ports"
            icon={<LanIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Logs"
            value="logs"
            icon={<DescriptionIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label="Terminal"
            value="terminal"
            icon={<TerminalIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>

        <Box>
          {tab === "overview" && renderOverviewTab()}
          {tab === "processes" && renderProcessesTab()}
          {tab === "network" && renderNetworkTab()}
          {tab === "ports" && renderPortsTab()}
          {tab === "logs" && renderLogsTab()}
          {tab === "terminal" && renderTerminalTab()}
        </Box>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
};

export default AdminSystemPage;

MiniSparkline.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.shape({
        value: PropTypes.number.isRequired,
        ts: PropTypes.number,
      }),
    ])
  ),
  max: PropTypes.number,
};
