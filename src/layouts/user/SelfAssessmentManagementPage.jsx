import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Grid,
  Pagination,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import {
  useGetSelfAssessmentsQuery,
  useResetSelfAssessmentsMutation,
} from "slices/adminApiSlice";

const PAGE_SIZE = 20;

const fmtScore = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : "0.000";
};

const fmtDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
};

const displayName = (user = {}) =>
  user.nickname || user.name || user.phone || user.email || "Chưa có tên";

const tableCellSx = {
  py: 1.5,
  px: 2,
  verticalAlign: "middle",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const ellipsisSx = {
  display: "block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function SelfAssessmentManagementPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isFetching, refetch } = useGetSelfAssessmentsQuery({
    page,
    pageSize: PAGE_SIZE,
    keyword,
  });
  const [resetSelfAssessments, { isLoading: resetting }] =
    useResetSelfAssessmentsMutation();

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = data?.summary || {};

  const selectedInfo = useMemo(
    () => ({
      totalText: `${total} user`,
      avgSingle: fmtScore(summary.avgSingle),
      avgDouble: fmtScore(summary.avgDouble),
    }),
    [summary.avgDouble, summary.avgSingle, total],
  );

  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  const handleReset = async (userIds) => {
    const targetText = userIds?.length
      ? "user này"
      : keyword
        ? "toàn bộ kết quả đang lọc"
        : "toàn bộ user tự chấm chưa được admin chấm";
    if (!window.confirm(`Reset ${targetText} về 0 điểm?`)) return;

    try {
      const res = await resetSelfAssessments({
        ...(userIds?.length ? { userIds } : {}),
        ...(keyword && !userIds?.length ? { keyword } : {}),
      }).unwrap();
      showSnack("success", `Đã reset ${res?.reset ?? 0}/${res?.matched ?? 0} user`);
      await refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err?.error || "Không reset được điểm");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Card sx={{ flex: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Cần xử lý
              </Typography>
              <Typography variant="h4">{selectedInfo.totalText}</Typography>
              <Typography variant="body2" color="text.secondary">
                User có điểm tự chấm nhưng chưa có điểm admin/người chấm trình.
              </Typography>
            </Card>
            <Card sx={{ flex: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Trung bình điểm đơn
              </Typography>
              <Typography variant="h4">{selectedInfo.avgSingle}</Typography>
            </Card>
            <Card sx={{ flex: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Trung bình điểm đôi
              </Typography>
              <Typography variant="h4">{selectedInfo.avgDouble}</Typography>
            </Card>
          </Stack>

          <Card>
            <MDBox p={3}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-between"
                spacing={2}
                mb={2}
              >
                <Box>
                  <Typography variant="h5">Quản lý tự chấm trình</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Backend đã tắt tự chấm. Trang này dùng để kiểm tra và reset dữ liệu cũ.
                  </Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    size="small"
                    label="Tìm user"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tên, nick, SĐT, email"
                    sx={{ minWidth: 260 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => refetch()}
                    disabled={isFetching}
                  >
                    Tải lại
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => handleReset()}
                    disabled={resetting || total === 0}
                  >
                    Reset tất cả về 0
                  </Button>
                </Stack>
              </Stack>

              {isFetching && (
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Đang tải danh sách...
                  </Typography>
                </Stack>
              )}

              <TableContainer sx={{ overflowX: "hidden" }}>
                <Table
                  size="small"
                  sx={{
                    width: "100%",
                    tableLayout: "fixed",
                    "& .MuiTableCell-root": tableCellSx,
                  }}
                >
                  <colgroup>
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>VĐV</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Liên hệ</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        Điểm hiện tại
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        Tự chấm gần nhất
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        Trạng thái
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Thao tác
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((row) => {
                      const user = row.user || {};
                      const ranking = row.ranking || {};
                      const self = row.selfAssessment || {};
                      return (
                        <TableRow key={user._id || ranking._id}>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                              sx={{ minWidth: 0 }}
                            >
                              <Avatar src={user.avatar || ""}>
                                {displayName(user).charAt(0).toUpperCase()}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="button" sx={ellipsisSx}>
                                  {displayName(user)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                  sx={ellipsisSx}
                                >
                                  {user.province || "-"}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={ellipsisSx}>
                              {user.phone || "-"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={ellipsisSx}>
                              {user.email || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              Đơn {fmtScore(ranking.single)} / Đôi {fmtScore(ranking.double)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              Đơn {fmtScore(self.singleLevel)} / Đôi {fmtScore(self.doubleLevel)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {fmtDate(self.scoredAt || ranking.lastAssessmentAt)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              color="error"
                              variant="outlined"
                              label={ranking.tierLabel || "Tự chấm"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={resetting}
                              onClick={() => handleReset([user._id])}
                            >
                              Reset về 0
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!users.length && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Alert severity="success">
                            Không có user tự chấm chưa được admin chấm trong bộ lọc này.
                          </Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Grid container alignItems="center" justifyContent="space-between" mt={2}>
                <Grid item>
                  <Typography variant="caption" color="text.secondary">
                    Tổng {total} user
                  </Typography>
                </Grid>
                <Grid item>
                  <Pagination
                    page={page}
                    count={totalPages}
                    color="primary"
                    onChange={(_, nextPage) => setPage(nextPage)}
                  />
                </Grid>
              </Grid>
            </MDBox>
          </Card>
        </Stack>
      </MDBox>
      <Footer />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert
          severity={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
