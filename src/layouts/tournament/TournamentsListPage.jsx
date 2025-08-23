// src/layouts/tournament/TournamentsListPage.jsx
import { useState, useEffect } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
  const [input, setInput] = useState(keyword);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    const id = setTimeout(() => dispatch(setTKeyword(input.trim().toLowerCase())), 300);
    return () => clearTimeout(id);
  }, [input, dispatch]);

  const {
    data: { list: tournaments = [], total = 0 } = {},
    isLoading,
    error,
  } = useListTournamentsQuery(
    { page: page + 1, limit, keyword, status },
    { keepPreviousData: true }
  );
  const totalPages = Math.ceil(total / limit);

  const [del] = useDeleteTournamentMutation();
  const handleDelete = async (id) => {
    if (!window.confirm("Xoá giải này?")) return;
    try {
      await del(id).unwrap();
      toast.success("Đã xoá giải");
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  const columns = [
    { Header: "#", accessor: "idx", width: "6%", align: "center" },
    { Header: "Tên", accessor: "name", width: "26%" },
    { Header: "Thời gian", accessor: "time", width: "18%" },
    { Header: "Loại", accessor: "type", align: "center" },
    { Header: "Trạng thái", accessor: "status", align: "center" },
    { Header: "Đăng ký", accessor: "reg", align: "center" },
    { Header: "Hành động", accessor: "actions", align: "center", width: "18%" },
  ];

  const rows = tournaments.map((t, i) => ({
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
      <Stack direction="row" spacing={1} justifyContent="center">
        <Tooltip title="Tạo sơ đồ">
          <IconButton
            size="small"
            color="warning"
            onClick={() => navigate(`/admin/tournaments/${t._id}/blueprint`)}
          >
            <AccountTreeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Đăng ký">
          <IconButton
            size="small"
            color="info"
            onClick={() => navigate(`/admin/tournaments/${t._id}/registrations`)}
          >
            <ListAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Brackets">
          <IconButton
            size="small"
            color="primary"
            onClick={() => navigate(`/admin/tournaments/${t._id}/brackets`)}
          >
            <TableChartIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Matches">
          <IconButton
            size="small"
            color="secondary"
            onClick={() => navigate(`/admin/tournaments/${t._id}/matches`)}
          >
            <ListAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Sửa">
          <IconButton size="small" onClick={() => navigate(`/admin/tournaments/${t._id}/edit`)}>
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
  }));

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
                        onClick={() => navigate(`/admin/tournaments/${t._id}/registrations`)}
                      >
                        Đăng ký
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => navigate(`/admin/tournaments/${t._id}/brackets`)}
                      >
                        Brackets
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => navigate(`/admin/tournaments/${t._id}/matches`)}
                      >
                        Matches
                      </MDButton>
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => navigate(`/admin/tournaments/${t._id}/edit`)}
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
