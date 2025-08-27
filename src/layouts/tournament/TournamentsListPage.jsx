// src/layouts/tournament/TournamentsListPage.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  Tooltip,
  Grid,
  Paper,
  Pagination,
  TextField,
  Select,
  MenuItem,
} from "@mui/material";
import { AccountTree as AccountTreeIcon } from "@mui/icons-material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ListAlt as ListAltIcon,
  TableChart as TableChartIcon,
  Stadium as StadiumIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useListTournamentsQuery, useDeleteTournamentMutation } from "slices/tournamentsApiSlice";
import { setTKeyword, setTPage, setTStatus } from "slices/adminTournamentUiSlice";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import DataTable from "examples/Tables/DataTable";

const STATUS_LABEL = {
  upcoming: "Sắp diễn ra",
  ongoing: "Đang diễn ra",
  finished: "Đã diễn ra",
};
const STATUS_COLOR = { upcoming: "info", ongoing: "success", finished: "default" };

export default function TournamentsListPage() {
  const dispatch = useDispatch();
  const { page, limit, keyword, status } = useSelector((s) => s.adminTournamentUi);
  const [input, setInput] = useState(keyword || "");
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  /* ---------------- Debounce keyword & tránh dispatch lặp ---------------- */
  useEffect(() => {
    const id = setTimeout(() => {
      const next = (input || "").trim().toLowerCase();
      if (next !== (keyword || "")) {
        dispatch(setTKeyword(next));
      }
    }, 300);
    return () => clearTimeout(id);
    // cố ý KHÔNG đưa `dispatch`/`keyword` vào deps để tránh lặp do store thay đổi liên tục.
    // eslint-disable-next-line
  }, [input]);

  const {
    data: { list: tournaments = [], total = 0 } = {},
    isLoading,
    error,
  } = useListTournamentsQuery(
    { page: page + 1, limit, keyword, status },
    { keepPreviousData: true }
  );

  const totalPages = Math.ceil((total || 0) / (limit || 1));

  /* ---------------- Handlers ổn định ---------------- */
  const [del] = useDeleteTournamentMutation();

  const handleDelete = useCallback(
    async (id) => {
      if (!window.confirm("Xoá giải này?")) return;
      try {
        await del(id).unwrap();
        toast.success("Đã xoá giải");
      } catch (err) {
        toast.error(err?.data?.message || err.error);
      }
    },
    [del]
  );

  const goBlueprint = useCallback(
    (id) => navigate(`/admin/tournaments/${id}/blueprint`),
    [navigate]
  );
  const goRegs = useCallback(
    (id) => navigate(`/admin/tournaments/${id}/registrations`),
    [navigate]
  );
  const goBrackets = useCallback((id) => navigate(`/admin/tournaments/${id}/brackets`), [navigate]);
  const goMatches = useCallback((id) => navigate(`/admin/tournaments/${id}/matches`), [navigate]);
  const goEdit = useCallback((id) => navigate(`/admin/tournaments/${id}/edit`), [navigate]);
  const goCourts = useCallback((id) => navigate(`/admin/tournaments/${id}/courts`), [navigate]);
  /* ---------------- Memo hóa columns / rows / tableData ---------------- */
  const columns = useMemo(
    () => [
      { Header: "#", accessor: "idx", width: "6%", align: "center" },
      { Header: "Tên", accessor: "name", width: "26%" },
      { Header: "Thời gian", accessor: "time", width: "18%" },
      { Header: "Loại", accessor: "type", align: "center" },
      { Header: "Trạng thái", accessor: "status", align: "center" },
      { Header: "Đăng ký", accessor: "reg", align: "center" },
      { Header: "Hành động", accessor: "actions", align: "center", width: "18%" },
    ],
    []
  );

  const rows = useMemo(
    () =>
      tournaments.map((t, i) => ({
        idx: <MDTypography variant="caption">{page * limit + i + 1}</MDTypography>,
        name: (
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar src={t.image} variant="rounded" sx={{ width: 32, height: 32 }} />
            <MDTypography variant="button" fontWeight="medium">
              {t.name}
            </MDTypography>
          </Stack>
        ),
        time: (
          <MDTypography variant="caption" color="text">
            {new Date(t.startDate).toLocaleDateString()} –{" "}
            {new Date(t.endDate).toLocaleDateString()}
          </MDTypography>
        ),
        type: (
          <MDTypography variant="caption" color="text">
            {t.eventType === "double" ? "Đôi" : "Đơn"}
          </MDTypography>
        ),
        status: (
          <MDBadge
            variant="gradient"
            size="sm"
            badgeContent={STATUS_LABEL[t.status]}
            color={STATUS_COLOR[t.status]}
          />
        ),
        reg: (
          <MDTypography variant="caption" color="text">
            {t.registered}
          </MDTypography>
        ),
        actions: (
          <Stack direction="row" spacing={1} justifyContent="center">
            <Tooltip title="Tạo sơ đồ">
              <IconButton size="small" color="warning" onClick={() => goBlueprint(t._id)}>
                <AccountTreeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Đăng ký">
              <IconButton size="small" color="info" onClick={() => goRegs(t._id)}>
                <ListAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Brackets">
              <IconButton size="small" color="primary" onClick={() => goBrackets(t._id)}>
                <TableChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {/* <Tooltip title="Sân">
              <IconButton size="small" color="success" onClick={() => goCourts(t._id)}>
                <StadiumIcon fontSize="small" />
              </IconButton>
            </Tooltip> */}
            <Tooltip title="Matches">
              <IconButton size="small" color="secondary" onClick={() => goMatches(t._id)}>
                <ListAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sửa">
              <IconButton size="small" onClick={() => goEdit(t._id)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Xoá">
              <IconButton size="small" color="error" onClick={() => handleDelete(t._id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      })),
    [
      tournaments,
      page,
      limit,
      goBlueprint,
      goRegs,
      goBrackets,
      goCourts,
      goMatches,
      goEdit,
      handleDelete,
    ]
  );

  // Memo hóa object table để tránh identity mới mỗi render
  const tableData = useMemo(() => ({ columns, rows }), [columns, rows]);

  return (
    <DashboardLayout>
      <DashboardNavbar />

      {/* Toolbar */}
      <MDBox px={3} pt={4}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Tìm tên giải…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            sx={{ width: { xs: "100%", sm: 260 } }}
          />
          <Select
            size="small"
            value={status}
            onChange={(e) => dispatch(setTStatus(e.target.value))}
            displayEmpty
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="upcoming">Sắp diễn ra</MenuItem>
            <MenuItem value="ongoing">Đang diễn ra</MenuItem>
            <MenuItem value="finished">Đã diễn ra</MenuItem>
          </Select>
          <MDButton
            sx={{ ml: { sm: "auto" } }}
            startIcon={<AddIcon />}
            color="info"
            variant="gradient"
            onClick={() => navigate("/admin/tournaments/new")}
          >
            Tạo mới
          </MDButton>
        </Stack>
      </MDBox>

      {/* Content */}
      <MDBox pt={3} pb={3}>
        {isLoading ? (
          <MDBox py={6} textAlign="center">
            <CircularProgress />
          </MDBox>
        ) : error ? (
          <MDTypography color="error">{error?.data?.message || error.error}</MDTypography>
        ) : isMobile ? (
          // Mobile cards
          <Stack spacing={2}>
            {tournaments.map((t) => (
              <Paper key={t._id} sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Avatar src={t.image} variant="rounded" sx={{ width: "100%", height: 72 }} />
                  </Grid>
                  <Grid item xs={9}>
                    <MDTypography fontWeight="bold">{t.name}</MDTypography>
                    <MDTypography variant="caption" color="text">
                      {new Date(t.startDate).toLocaleDateString()} –{" "}
                      {new Date(t.endDate).toLocaleDateString()}
                    </MDTypography>
                    <Stack direction="row" spacing={1} mt={1}>
                      <Chip label={STATUS_LABEL[t.status]} size="small" />
                      <Chip label={t.eventType === "double" ? "Đôi" : "Đơn"} size="small" />
                    </Stack>
                    <Stack direction="row" spacing={1} mt={2}>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="info"
                        onClick={() => goRegs(t._id)}
                      >
                        Đăng ký
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => goBrackets(t._id)}
                      >
                        Brackets
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => goCourts(t._id)}
                      >
                        Sân
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => goMatches(t._id)}
                      >
                        Matches
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => goEdit(t._id)}
                      >
                        Sửa
                      </MDButton>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>
        ) : (
          // Desktop table
          <Card>
            <DataTable
              table={tableData}
              isSorted={false}
              entriesPerPage={false}
              showTotalEntries={false}
              noEndBorder
              canSearch={false}
            />
            <MDBox py={2} display="flex" justifyContent="center">
              <Pagination
                color="primary"
                count={totalPages}
                page={page + 1}
                onChange={(_, v) => dispatch(setTPage(v - 1))}
              />
            </MDBox>
          </Card>
        )}
      </MDBox>

      <Footer />
    </DashboardLayout>
  );
}
