import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useGetPrimaryLogsQuery } from "slices/observerAdminApiSlice";

const DEFAULT_FILTERS = {
  q: "",
  level: "",
  category: "",
  method: "",
  routingMode: "",
  userId: "",
  archivedFromObserver: "all",
  since: "",
  until: "",
};

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function formatMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${new Intl.NumberFormat("vi-VN").format(numeric)} ms`;
}

function levelColor(level) {
  if (level === "error") return "error";
  if (level === "warn") return "warning";
  return "info";
}

function statusColor(statusCode) {
  const numeric = Number(statusCode);
  if (!Number.isFinite(numeric)) return "default";
  if (numeric >= 500) return "error";
  if (numeric >= 400) return "warning";
  if (numeric >= 300) return "info";
  return "success";
}

const TABLE_CELL_SX = {
  py: 1.2,
  whiteSpace: "normal",
  wordBreak: "break-word",
  verticalAlign: "top",
};

const TABLE_HEAD_SX = {
  display: "table-header-group",
  "& .MuiTableRow-root": {
    display: "table-row",
  },
  "& .MuiTableCell-root": {
    bgcolor: "grey.100",
    fontWeight: 800,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    wordBreak: "normal",
  },
};

const TABLE_CELL_ELLIPSIS_SX = {
  width: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function resolveUserId(payload) {
  return (
    payload?.userId ||
    payload?.user?.id ||
    payload?.user?._id ||
    payload?.actor?.id ||
    payload?.actor?.userId ||
    payload?.actorId ||
    "-"
  );
}

export default function PrimaryLogsPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(100);

  const queryArgs = useMemo(
    () => ({
      ...filters,
      page: page + 1,
      limit,
    }),
    [filters, page, limit]
  );

  const { data, error, isLoading, isFetching, refetch } =
    useGetPrimaryLogsQuery(queryArgs);

  const rows = data?.items || [];

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" fontWeight={700}>
                Nhật ký hệ thống
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tra cứu log đã lưu trong DB chính. Log đã được sync sang Observer sẽ quay lại đây sau khi
                đóng băng đêm.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Tải lại
            </Button>
          </Stack>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Tìm path, requestId, lý do"
                    value={filters.q}
                    onChange={handleFilterChange("q")}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Mức độ"
                    value={filters.level}
                    onChange={handleFilterChange("level")}
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="">Tất cả</MenuItem>
                    <MenuItem value="info">info</MenuItem>
                    <MenuItem value="warn">warn</MenuItem>
                    <MenuItem value="error">error</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Nguồn lưu"
                    value={filters.archivedFromObserver}
                    onChange={handleFilterChange("archivedFromObserver")}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="all">Tất cả</MenuItem>
                    <MenuItem value="false">DB chính trực tiếp</MenuItem>
                    <MenuItem value="true">Sync từ Observer</MenuItem>
                  </TextField>
                  <TextField
                    label="User ID"
                    value={filters.userId}
                    onChange={handleFilterChange("userId")}
                    sx={{ minWidth: 250 }}
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Category"
                    value={filters.category}
                    onChange={handleFilterChange("category")}
                    fullWidth
                  />
                  <TextField
                    label="Method"
                    value={filters.method}
                    onChange={handleFilterChange("method")}
                    sx={{ minWidth: 140 }}
                  />
                  <TextField
                    label="Routing mode"
                    value={filters.routingMode}
                    onChange={handleFilterChange("routingMode")}
                    fullWidth
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Từ"
                    type="datetime-local"
                    value={filters.since}
                    onChange={handleFilterChange("since")}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Đến"
                    type="datetime-local"
                    value={filters.until}
                    onChange={handleFilterChange("until")}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <Button variant="text" onClick={resetFilters}>
                    Xóa lọc
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {isFetching ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

          {error ? (
            <Alert severity="error">
              {error?.data?.message || "Không thể tải nhật ký hệ thống."}
            </Alert>
          ) : null}

          <Card variant="outlined">
            <TableContainer
              sx={{ maxHeight: "68vh", overflowX: "auto", "& .MuiTableCell-root": TABLE_CELL_SX }}
            >
              <Table stickyHeader size="small" sx={{ minWidth: 1280, tableLayout: "fixed" }}>
                <TableHead sx={TABLE_HEAD_SX}>
                  <TableRow>
                    <TableCell sx={{ width: 170 }}>Thời gian</TableCell>
                    <TableCell sx={{ width: 100 }}>Level</TableCell>
                    <TableCell sx={{ width: 170 }}>User ID</TableCell>
                    <TableCell sx={{ width: 320 }}>Route</TableCell>
                    <TableCell sx={{ width: 100 }}>Status</TableCell>
                    <TableCell sx={{ width: 120 }}>Duration</TableCell>
                    <TableCell sx={{ width: 180 }}>Routing</TableCell>
                    <TableCell sx={{ width: 140 }}>Nguồn lưu</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {formatDateTime(row.occurredAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.source || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.level || "-"} color={levelColor(row.level)} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            ...TABLE_CELL_ELLIPSIS_SX,
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                          }}
                        >
                          {resolveUserId(row.payload)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} sx={TABLE_CELL_ELLIPSIS_SX}>
                          {row.method || "-"} {row.path || "-"}
                        </Typography>
                        <Tooltip title={row.url || ""}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ ...TABLE_CELL_ELLIPSIS_SX, display: "block" }}
                          >
                            {row.url || row.requestId || "-"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.statusCode ?? "-"}
                          color={statusColor(row.statusCode)}
                        />
                      </TableCell>
                      <TableCell>{formatMs(row.durationMs)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {row.routingMode || row.payload?.smartLogMode || "-"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.payload?.smartLogReason || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.archivedFromObserver ? "Sync từ Observer" : "DB chính"}
                          color={row.archivedFromObserver ? "warning" : "success"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                          Không có log phù hợp.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={Number(data?.total || 0)}
              page={page}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={limit}
              onRowsPerPageChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[50, 100, 200, 300]}
              labelRowsPerPage="Số dòng"
            />
          </Card>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
