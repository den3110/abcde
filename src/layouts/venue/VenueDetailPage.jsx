/* eslint-disable react/prop-types */
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Grid,
  Card,
  Chip,
  Stack,
  Divider,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  useGetVenueAdminQuery,
  useSetVenueStatusMutation,
} from "slices/venueAdminApiSlice";

const fmtVND = (n) => `${(Number(n) || 0).toLocaleString("vi-VN")}đ`;
const tz = { timeZone: "Asia/Bangkok" };
const dt = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", ...tz }) : "—";

const BOOKING_STATUS = {
  pending: { label: "Chờ duyệt", color: "warning" },
  confirmed: { label: "Đã xác nhận", color: "success" },
  cancelled: { label: "Đã huỷ", color: "default" },
  completed: { label: "Hoàn tất", color: "info" },
  no_show: { label: "Không đến", color: "error" },
};

function Kpi({ label, value, color = "dark" }) {
  return (
    <Card sx={{ p: 2 }}>
      <MDTypography variant="caption" color="text">
        {label}
      </MDTypography>
      <MDTypography variant="h5" color={color} fontWeight="bold">
        {value}
      </MDTypography>
    </Card>
  );
}

export default function VenueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isFetching } = useGetVenueAdminQuery(id);
  const [setVenueStatus, { isLoading: saving }] = useSetVenueStatusMutation();

  const venue = data?.venue;

  const changeStatus = async (status) => {
    try {
      await setVenueStatus({ id, status, isActive: status === "active" }).unwrap();
      toast.success("Đã cập nhật trạng thái");
    } catch (e) {
      toast.error(e?.data?.message || "Cập nhật thất bại");
    }
  };

  if (isFetching && !data) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={10} textAlign="center">
          <CircularProgress />
        </MDBox>
        <Footer />
      </DashboardLayout>
    );
  }

  const courtCols = [
    { Header: "Sân", accessor: "name", align: "left" },
    { Header: "Giá mặc định", accessor: "price", align: "right" },
    { Header: "Khung giá riêng", accessor: "rules", align: "center" },
    { Header: "Trạng thái", accessor: "status", align: "center" },
  ];
  const courtRows = (data?.courts || []).map((c) => ({
    name: <MDTypography variant="button" fontWeight="medium">{c.name}</MDTypography>,
    price: <MDTypography variant="button">{fmtVND(c.defaultPricePerHour)}/giờ</MDTypography>,
    rules: <MDTypography variant="button">{c.priceRules?.length || 0}</MDTypography>,
    status: (
      <Chip
        size="small"
        color={c.status === "maintenance" ? "warning" : "success"}
        label={c.status === "maintenance" ? "Bảo trì" : "Hoạt động"}
      />
    ),
  }));

  const bkCols = [
    { Header: "Mã", accessor: "code", align: "left" },
    { Header: "Sân", accessor: "court", align: "left" },
    { Header: "Thời gian", accessor: "time", align: "left" },
    { Header: "Khách", accessor: "customer", align: "left" },
    { Header: "Tiền", accessor: "price", align: "right" },
    { Header: "Trạng thái", accessor: "status", align: "center" },
    { Header: "TT", accessor: "pay", align: "center" },
  ];
  const bkRows = (data?.recentBookings || []).map((b) => {
    const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
    return {
      code: <MDTypography variant="button">{b.code}</MDTypography>,
      court: <MDTypography variant="button">{b.court?.name || "—"}</MDTypography>,
      time: <MDTypography variant="button">{dt(b.startAt)}</MDTypography>,
      customer: (
        <MDTypography variant="button">
          {b.customerName || b.user?.name || "Khách"}
        </MDTypography>
      ),
      price: <MDTypography variant="button">{fmtVND(b.totalPrice)}</MDTypography>,
      status: <Chip size="small" color={st.color} label={st.label} />,
      pay: (
        <Chip
          size="small"
          variant="outlined"
          color={b.payment?.status === "Paid" ? "success" : "warning"}
          label={b.payment?.status === "Paid" ? "Đã thu" : "Chưa"}
        />
      ),
    };
  });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={3}>
        <MDButton variant="text" color="info" onClick={() => navigate("/admin/venues")} sx={{ mb: 1 }}>
          <ArrowBackIcon />&nbsp;Danh sách cụm sân
        </MDButton>

        {/* Header */}
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <MDBox>
              <MDTypography variant="h4" fontWeight="bold">
                {venue?.name}
              </MDTypography>
              <MDTypography variant="button" color="text" display="block">
                {venue?.address || "—"} {venue?.province ? `• ${venue.province}` : ""}
              </MDTypography>
              <MDTypography variant="button" color="text" display="block">
                Chủ sân: <b>{venue?.owner?.name || "—"}</b>
                {venue?.owner?.phone ? ` • ${venue.owner.phone}` : ""}
              </MDTypography>
            </MDBox>
            <Stack spacing={1} alignItems={{ md: "flex-end" }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Trạng thái</InputLabel>
                <Select
                  label="Trạng thái"
                  value={venue?.status || "active"}
                  disabled={saving}
                  onChange={(e) => changeStatus(e.target.value)}
                >
                  <MenuItem value="active">Đang mở</MenuItem>
                  <MenuItem value="pending">Chờ duyệt</MenuItem>
                  <MenuItem value="suspended">Tạm khoá</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Card>

        {/* KPIs */}
        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={6} md={3}>
            <Kpi label="Doanh thu đã thu" value={fmtVND(data?.paidRevenue)} color="success" />
          </Grid>
          <Grid item xs={6} md={3}>
            <Kpi label="Lượt đã thu" value={data?.paidCount || 0} color="info" />
          </Grid>
          <Grid item xs={6} md={3}>
            <Kpi label="Số sân" value={(data?.courts || []).length} />
          </Grid>
          <Grid item xs={6} md={3}>
            <Kpi label="Chờ duyệt" value={data?.statusCounts?.pending || 0} color="warning" />
          </Grid>
        </Grid>

        {/* Courts */}
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12} md={5}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="h6">Danh sách sân</MDTypography>
              </MDBox>
              <Divider sx={{ m: 0 }} />
              <DataTable table={{ columns: courtCols, rows: courtRows }} isSorted={false} entriesPerPage={false} showTotalEntries={false} noEndBorder canSearch={false} />
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="h6">Lượt đặt gần đây</MDTypography>
              </MDBox>
              <Divider sx={{ m: 0 }} />
              <DataTable table={{ columns: bkCols, rows: bkRows }} isSorted={false} entriesPerPage={false} showTotalEntries={false} noEndBorder canSearch={false} />
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
