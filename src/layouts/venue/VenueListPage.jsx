/* eslint-disable react/prop-types */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Grid,
  Card,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Chip,
  Stack,
  Pagination,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  useListVenuesAdminQuery,
  useSetVenueStatusMutation,
} from "slices/venueAdminApiSlice";

const fmtVND = (n) => `${(Number(n) || 0).toLocaleString("vi-VN")}đ`;
const STATUS = {
  active: { label: "Đang mở", color: "success" },
  pending: { label: "Chờ duyệt", color: "warning" },
  suspended: { label: "Tạm khoá", color: "error" },
};

export default function VenueListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const limit = 20;

  const { data, isFetching } = useListVenuesAdminQuery(
    { page: page + 1, limit, keyword: applied, status },
    { refetchOnMountOrArgChange: true },
  );
  const [setVenueStatus] = useSetVenueStatusMutation();

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const doSearch = () => {
    setApplied(keyword.trim());
    setPage(0);
  };

  const toggleLock = async (v) => {
    const lock = v.status !== "suspended" && v.isActive !== false;
    try {
      await setVenueStatus({
        id: v._id,
        status: lock ? "suspended" : "active",
        isActive: !lock,
      }).unwrap();
      toast.success(lock ? "Đã khoá cụm sân" : "Đã mở lại cụm sân");
    } catch (e) {
      toast.error(e?.data?.message || "Thao tác thất bại");
    }
  };

  const columns = [
    { Header: "Tên cụm sân", accessor: "name", align: "left" },
    { Header: "Chủ sân", accessor: "owner", align: "left" },
    { Header: "Tỉnh/TP", accessor: "province", align: "left" },
    { Header: "Số sân", accessor: "courts", align: "center" },
    { Header: "Trạng thái", accessor: "status", align: "center" },
    { Header: "Thao tác", accessor: "act", align: "center", width: "16%" },
  ];

  const rows = items.map((v) => {
    const st = STATUS[v.status] || STATUS.active;
    const locked = v.status === "suspended" || v.isActive === false;
    return {
      name: (
        <MDBox>
          <MDTypography variant="button" fontWeight="medium" display="block">
            {v.name}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            {v.address || "—"}
          </MDTypography>
        </MDBox>
      ),
      owner: (
        <MDBox>
          <MDTypography variant="button" display="block">
            {v.owner?.name || "—"}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            {v.owner?.phone || v.owner?.email || ""}
          </MDTypography>
        </MDBox>
      ),
      province: <MDTypography variant="button">{v.province || "—"}</MDTypography>,
      courts: <MDTypography variant="button">{v.courtCount || 0}</MDTypography>,
      status: <Chip size="small" color={st.color} label={st.label} />,
      act: (
        <Stack direction="row" spacing={1} justifyContent="center">
          <MDButton
            size="small"
            variant="outlined"
            color="info"
            iconOnly
            onClick={() => navigate(`/admin/venues/${v._id}`)}
          >
            <VisibilityIcon />
          </MDButton>
          <MDButton
            size="small"
            variant="outlined"
            color={locked ? "success" : "error"}
            onClick={() => toggleLock(v)}
          >
            {locked ? <LockOpenIcon /> : <LockIcon />}
            &nbsp;{locked ? "Mở" : "Khoá"}
          </MDButton>
        </Stack>
      ),
    };
  });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={3}>
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <MDTypography variant="h5" fontWeight="medium" sx={{ flex: 1 }}>
              Quản lý cụm sân
            </MDTypography>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Trạng thái</InputLabel>
              <Select
                label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="active">Đang mở</MenuItem>
                <MenuItem value="pending">Chờ duyệt</MenuItem>
                <MenuItem value="suspended">Tạm khoá</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Tìm tên/địa chỉ…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <MDButton variant="gradient" color="info" onClick={doSearch}>
              Tìm
            </MDButton>
          </Stack>
        </Card>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              {isFetching ? (
                <MDBox py={6} textAlign="center">
                  <CircularProgress />
                </MDBox>
              ) : (
                <>
                  <DataTable
                    table={{ columns, rows }}
                    isSorted={false}
                    entriesPerPage={false}
                    showTotalEntries={false}
                    noEndBorder
                    canSearch={false}
                  />
                  <MDBox py={2} display="flex" justifyContent="space-between" alignItems="center" px={2}>
                    <MDTypography variant="caption" color="text">
                      Tổng {total} cụm sân
                    </MDTypography>
                    <Pagination
                      page={page + 1}
                      count={totalPages}
                      color="info"
                      onChange={(_, v) => setPage(v - 1)}
                    />
                  </MDBox>
                </>
              )}
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
