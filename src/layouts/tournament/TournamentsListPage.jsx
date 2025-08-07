import { useState, useEffect } from "react";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Pagination,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Add, Delete, Edit, ListAlt } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useListTournamentsQuery, useDeleteTournamentMutation } from "slices/tournamentsApiSlice";
import { setTKeyword, setTPage, setTStatus } from "slices/adminTournamentUiSlice";
import { toast } from "react-toastify";

/* Creative-Tim */
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAvatar from "components/MDAvatar";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import DataTable from "examples/Tables/DataTable";

/* ----- const ----- */
const STATUS_LABEL = {
  upcoming: "Sắp diễn ra",
  ongoing: "Đang diễn ra",
  finished: "Đã diễn ra",
};
const STATUS_COLOR = { upcoming: "info", ongoing: "success", finished: "default" };

/* ============================================================== */
export default function TournamentsListPage() {
  /* ---------- Redux UI-state ---------- */
  const { page, limit, keyword, status } = useSelector((s) => s.adminTournamentUi);
  const dispatch = useDispatch();

  /* ---------- search debounce ---------- */
  const [input, setInput] = useState(keyword);
  useEffect(() => {
    const id = setTimeout(() => dispatch(setTKeyword(input.trim().toLowerCase())), 300);
    return () => clearTimeout(id);
  }, [input, dispatch]);

  /* ---------- Query ---------- */
  const {
    data = { list: [], total: 0 },
    isLoading,
    error,
  } = useListTournamentsQuery(
    { page: page + 1, limit, keyword, status },
    { keepPreviousData: true }
  );

  const tournaments = data.list;
  const totalPages = Math.ceil(data.total / limit);

  /* ---------- hooks ---------- */
  const [del] = useDeleteTournamentMutation();
  const nav = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  /* ---------- delete ---------- */
  const handleDelete = async (id) => {
    if (!window.confirm("Xoá giải này?")) return;
    try {
      await del(id).unwrap();
      toast.success("Đã xoá");
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  /* ---------- columns ---------- */
  const columns = [
    { Header: "#", accessor: "idx", width: "6%", align: "center" },
    { Header: "tên", accessor: "name", width: "26%" },
    { Header: "thời gian", accessor: "time", width: "18%" },
    { Header: "loại", accessor: "type", align: "center" },
    { Header: "trạng thái", accessor: "status", align: "center" },
    { Header: "đăng ký", accessor: "reg", align: "center" },
    { Header: "hành động", accessor: "actions", align: "center", width: "12%" },
  ];

  const rows = tournaments.map((t, i) => ({
    idx: <MDTypography variant="caption">{page * limit + i + 1}</MDTypography>,
    name: (
      <Stack direction="row" spacing={1} alignItems="center">
        <MDAvatar src={t.image} size="sm" variant="rounded" />
        <MDTypography variant="button" fontWeight="medium">
          {t.name}
        </MDTypography>
      </Stack>
    ),
    time: (
      <MDTypography variant="caption" color="text">
        {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()}
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
      <>
        {/* 👉 NEW: xem danh sách đăng ký */}
        <Tooltip title="Đăng ký">
          <IconButton
            size="small"
            color="info"
            onClick={() => nav(`/admin/tournaments/${t._id}/registrations`)}
          >
            <ListAlt fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Sửa">
          <IconButton size="small" onClick={() => nav(`/admin/tournaments/${t._id}/edit`)}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Xoá">
          <IconButton size="small" color="error" onClick={() => handleDelete(t._id)}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </>
    ),
  }));

  /* ---------- UI ---------- */
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
            <MenuItem value="">All status</MenuItem>
            <MenuItem value="upcoming">Upcoming</MenuItem>
            <MenuItem value="ongoing">Ongoing</MenuItem>
            <MenuItem value="finished">Finished</MenuItem>
          </Select>

          <MDButton
            sx={{ ml: { sm: "auto" } }}
            startIcon={<Add />}
            color="info"
            variant="gradient"
            onClick={() => nav("/admin/tournaments/new")}
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
          /* ---- Mobile card list ---- */
          <Stack spacing={2}>
            {tournaments.map((t) => (
              <Paper key={t._id} sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Avatar src={t.image} variant="rounded" sx={{ width: 1, height: 72 }} />
                  </Grid>
                  <Grid item xs={9}>
                    <MDTypography fontWeight="bold">{t.name}</MDTypography>
                    <MDTypography variant="caption" color="text">
                      {new Date(t.startDate).toLocaleDateString()} –{" "}
                      {new Date(t.endDate).toLocaleDateString()}
                    </MDTypography>

                    <Stack direction="row" spacing={1} mt={1}>
                      <Chip label={t.status} size="small" />
                      <Chip label={t.eventType === "double" ? "Đôi" : "Đơn"} size="small" />
                    </Stack>

                    <Stack direction="row" spacing={1} mt={2}>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="info"
                        startIcon={<Edit />}
                        onClick={() => nav(`/admin/tournaments/${t._id}/edit`)}
                      >
                        Sửa
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => handleDelete(t._id)}
                      >
                        Xoá
                      </MDButton>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>
        ) : (
          /* ---- Desktop table ---- */
          <Card>
            <DataTable
              table={{ columns, rows }}
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
