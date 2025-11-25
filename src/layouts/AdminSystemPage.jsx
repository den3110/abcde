// src/screens/admin/AdminSystemPage.jsx
import React, { useEffect, useState } from "react";
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
} from "slices/adminSystemApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

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

/* ======================= DataGrid Columns ======================= */

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

// Processes
const processColumns = [
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

// Services
const servicesColumns = [
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

const AdminSystemPage = () => {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [tab, setTab] = useState("overview");

  // === STATE cho processes tab ===
  const [procSortBy, setProcSortBy] = useState("cpu");
  const [procLimit, setProcLimit] = useState(20);

  // === STATE cho logs tab ===
  const [selectedLogType, setSelectedLogType] = useState("");
  const [logLines, setLogLines] = useState(300);
  const [logAutoRefresh, setLogAutoRefresh] = useState(false);

  // === STATE cho terminal tab ===
  const [selectedCmdKey, setSelectedCmdKey] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalError, setTerminalError] = useState("");

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

  const handleRunCommand = async () => {
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
      setTerminalError(err?.data?.error || err?.error || "Có lỗi khi chạy command");
    }
  };

  const handleChangeTab = (event, newValue) => {
    setTab(newValue);
  };

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

    const servicesRows =
      services?.map((svc, idx) => ({
        id: svc.name || idx,
        ...svc,
      })) || [];

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
          <Box sx={{ width: "100%" }}>
            <DataGrid
              autoHeight
              density="compact"
              rows={processRows}
              columns={processColumns}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
              }}
              disableRowSelectionOnClick
              loading={processesLoading}
            />
          </Box>
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
              loading={servicesLoading}
            />
          </Box>
        )}
      </Stack>
    );
  };

  const renderNetworkTab = () => {
    const networkRows =
      network?.map((iface, idx) => ({
        id: iface.name || idx,
        ...iface,
      })) || [];

    return (
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <RouterIcon fontSize="small" />
            <Typography variant="h6">Network interfaces</Typography>
          </Stack>
          <IconButton size="small" onClick={() => refetchNetwork()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
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
    return (
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LanIcon fontSize="small" />
            <Typography variant="h6">Open ports (ss / netstat)</Typography>
          </Stack>
          <IconButton size="small" onClick={() => refetchPorts()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
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
            {ports.output}
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

          <Stack direction="row" spacing={1} alignItems="center">
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
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: "background.default",
              borderRadius: 1,
              maxHeight: 550,
              overflow: "auto",
              fontSize: 13,
              fontFamily: "Roboto Mono, monospace",
            }}
          >
            {/* path + info */}
            <Typography variant="caption" color="text.secondary">
              {logTail.label} — {logTail.path} (last {logTail.lines} lines)
            </Typography>
            {"\n\n"}
            {logTail.text}
          </Box>
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
      </Box>
    </DashboardLayout>
  );
};

export default AdminSystemPage;
