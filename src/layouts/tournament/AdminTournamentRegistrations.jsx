// src/screens/admin/AdminTournamentRegistrations.jsx
/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from "react";
import {
  Avatar,
  Box,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Pagination,
  Snackbar,
  Alert,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Divider,
} from "@mui/material";
import { ArrowBack, Paid, MoneyOff, Delete as DeleteIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DataTable from "examples/Tables/DataTable";

import {
  useGetTournamentQuery,
  useGetRegistrationsQuery,
  useUpdatePaymentMutation,
  useDeleteRegistrationMutation,
  useListTournamentManagersQuery,
  useAddTournamentManagerMutation,
  useRemoveTournamentManagerMutation,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";

function normType(t) {
  const s = String(t || "").toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return s || "double";
}
const PLACE = "";

export default function AdminTournamentRegistrations() {
  const { id } = useParams();
  const nav = useNavigate();

  /* ───── queries ───── */
  const { data: tour, error: tourError } = useGetTournamentQuery(id);
  const {
    data: regs = [],
    isLoading: regsLoading,
    error: regsError,
    refetch,
  } = useGetRegistrationsQuery(id);

  // managers
  const {
    data: managers = [],
    refetch: refetchManagers,
    isFetching: managersLoading,
  } = useListTournamentManagersQuery(id);

  /* ───── mutation ───── */
  const [updatePay] = useUpdatePaymentMutation();
  const [deleteReg] = useDeleteRegistrationMutation();
  const [addManager] = useAddTournamentManagerMutation();
  const [removeManager] = useRemoveTournamentManagerMutation();

  const [confirmDel, setConfirmDel] = useState(null); // reg obj or null

  /* ───── snackbar ───── */
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  /* ───── pagination ───── */
  const [page, setPage] = useState(1);
  const perPage = 10;

  const totalPages = Math.ceil(regs.length / perPage);
  const paged = useMemo(() => regs.slice((page - 1) * perPage, page * perPage), [regs, page]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const evType = normType(tour?.eventType);
  const isSingles = evType === "single";

  /* ───── side-effects ───── */
  useEffect(() => {
    if (tourError) showSnack("error", tourError?.data?.message || tourError.error);
  }, [tourError]);

  useEffect(() => {
    if (regsError) {
      showSnack("error", regsError?.data?.message || regsError.error);
    } else if (!regsLoading) {
      showSnack("info", `Đã tải ${regs.length} lượt đăng ký`);
    }
  }, [regsLoading, regsError, regs.length]);

  /* ───── helpers ───── */
  const handleToggle = async (reg) => {
    const next = reg.payment.status === "Paid" ? "Unpaid" : "Paid";
    try {
      await updatePay({ regId: reg._id, status: next }).unwrap();
      showSnack(
        "success",
        next === "Paid" ? "Đã xác nhận thanh toán" : "Đã huỷ xác nhận thanh toán"
      );
      refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Cập nhật thất bại");
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteReg(confirmDel._id).unwrap();
      showSnack("success", "Đã xoá đăng ký");
      setConfirmDel(null);
      refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Xoá thất bại");
    }
  };

  const renderAthlete = (pl) => {
    if (!pl)
      return (
        <MDTypography variant="caption" color="text">
          —
        </MDTypography>
      );
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar src={pl.avatar || PLACE} />
        <Box>
          <MDTypography variant="button">{pl.fullName}</MDTypography>
          <div></div>
          <MDTypography variant="caption" color="text">
            {pl.phone}
          </MDTypography>
        </Box>
      </Stack>
    );
  };

  /* ───── Managers panel: search users ───── */
  const [mgrKeyword, setMgrKeyword] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: userSearch, isFetching: searchingUsers } = useGetUsersQuery(
    { page: 1, keyword: mgrKeyword, role: "" },
    { skip: mgrKeyword.trim().length < 1 } // gõ mới search
  );

  const userOptions = (userSearch?.users || []).map((u) => ({
    id: u._id,
    label: `${u.nickname || u.name || ""} • ${u.phone || ""} • ${u.email}`,
    name: u.name,
    nickname: u.nickname,
    phone: u.phone,
    email: u.email,
    avatar: u.avatar,
  }));

  const onAddManager = async () => {
    if (!selectedUser?.id) return;
    try {
      await addManager({ tournamentId: id, userId: selectedUser.id }).unwrap();
      showSnack("success", "Đã thêm người quản lý giải");
      setSelectedUser(null);
      setMgrKeyword("");
      refetchManagers();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Thêm thất bại");
    }
  };

  const onRemoveManager = async (uid) => {
    try {
      await removeManager({ tournamentId: id, userId: uid }).unwrap();
      showSnack("success", "Đã xoá người quản lý");
      refetchManagers();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Xoá thất bại");
    }
  };

  /* ───── DataTable config ───── */
  const columns = useMemo(() => {
    const base = [
      { Header: "#", accessor: "idx", align: "center", width: "6%" },
      { Header: isSingles ? "Vận động viên" : "Vận động viên 1", accessor: "ath1" },
    ];
    if (!isSingles) base.push({ Header: "Vận động viên 2", accessor: "ath2" });
    base.push(
      { Header: "Ngày đăng ký", accessor: "created" },
      { Header: "Lệ phí", accessor: "fee", align: "center" },
      { Header: "Thao tác", accessor: "act", align: "center" }
    );
    return base;
  }, [isSingles]);

  const rows = useMemo(
    () =>
      paged.map((r, i) => ({
        idx: <MDTypography variant="caption">{(page - 1) * perPage + i + 1}</MDTypography>,
        ath1: renderAthlete(r.player1),
        ...(isSingles ? {} : { ath2: renderAthlete(r.player2) }),
        created: (
          <MDTypography variant="caption">{new Date(r.createdAt).toLocaleString()}</MDTypography>
        ),
        fee: (
          <Chip
            size="small"
            color={r.payment.status === "Paid" ? "success" : "default"}
            label={r.payment.status === "Paid" ? "Đã thanh toán" : "Chưa thanh toán"}
          />
        ),
        act: (
          <>
            <IconButton
              color={r.payment.status === "Paid" ? "error" : "success"}
              onClick={() => handleToggle(r)}
              title={
                r.payment.status === "Paid" ? "Đánh dấu chưa thanh toán" : "Xác nhận thanh toán"
              }
            >
              {r.payment.status === "Paid" ? <MoneyOff /> : <Paid />}
            </IconButton>
            <IconButton color="error" onClick={() => setConfirmDel(r)} title="Xoá đăng ký">
              <DeleteIcon />
            </IconButton>
          </>
        ),
      })),
    [paged, page, isSingles]
  );

  /* ───── render ───── */
  return (
    <DashboardLayout>
      <DashboardNavbar />

      {/* header */}
      <MDBox px={3} pt={3}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <IconButton onClick={() => nav(-1)} aria-label="Quay lại">
            <ArrowBack />
          </IconButton>
          <MDTypography variant="h5">Danh sách đăng ký</MDTypography>
        </Stack>
        {tour && (
          <Typography variant="caption" color="text.secondary" fontSize={16}>
            {tour.name} • {new Date(tour.startDate).toLocaleDateString()} –{" "}
            {new Date(tour.endDate).toLocaleDateString()} • {isSingles ? "Giải đơn" : "Giải đôi"}
          </Typography>
        )}
      </MDBox>

      {/* Managers panel */}
      <MDBox px={3} pt={1} pb={2}>
        <Card>
          <MDBox p={2}>
            <MDTypography variant="h6">Quản lý đăng ký giải đấu</MDTypography>
            <Typography variant="caption" color="text.secondary">
              Thêm người quản lý: có quyền xác nhận/huỷ lệ phí và xoá đăng ký cho giải này.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              mt={2}
            >
              <Autocomplete
                fullWidth
                value={selectedUser}
                onChange={(_, v) => setSelectedUser(v)}
                onInputChange={(_, v) => setMgrKeyword(v)}
                options={userOptions}
                loading={searchingUsers}
                filterOptions={(x) => x} // không filter client, rely server
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tìm người dùng theo SĐT / nickname / email"
                    placeholder="Nhập để tìm…"
                  />
                )}
                renderOption={(props, opt) => (
                  <li {...props} key={opt.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={opt.avatar || ""} sx={{ width: 28, height: 28 }} />
                      <span>
                        <b>{opt.nickname || opt.name}</b> • {opt.phone || "-"} • {opt.email}
                      </span>
                    </Stack>
                  </li>
                )}
              />

              <Button
                sx={{ color: "white !important" }}
                variant="contained"
                onClick={onAddManager}
                disabled={!selectedUser}
              >
                Thêm quản lý
              </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <MDTypography variant="subtitle2" gutterBottom>
              Danh sách người quản lý
            </MDTypography>

            {managersLoading ? (
              <Box textAlign="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <DataTable
                table={{
                  columns: [
                    { Header: "Người quản lý", accessor: "u", align: "left" },
                    { Header: "Liên hệ", accessor: "c", align: "left" },
                    { Header: "Thao tác", accessor: "act", align: "center", width: "10%" },
                  ],
                  rows: (managers || []).map((m) => ({
                    u: (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar src={m.user?.avatar || ""} />
                        <Box>
                          <MDTypography variant="button">
                            {m.user?.nickname || m.user?.name}
                          </MDTypography>
                          <div />
                          <MDTypography variant="caption" color="text">
                            ID: {m.user?._id}
                          </MDTypography>
                        </Box>
                      </Stack>
                    ),
                    c: (
                      <MDTypography variant="caption" color="text">
                        {m.user?.phone || "-"} • {m.user?.email}
                      </MDTypography>
                    ),
                    act: (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ color: "error.main" }}
                        onClick={() => {
                          const label =
                            m?.user?.nickname || m?.user?.name || m?.user?.phone || m?.user?._id;
                          if (window.confirm(`Xoá người quản lý "${label}"?`)) {
                            onRemoveManager(m.user?._id);
                          }
                        }}
                      >
                        Xoá
                      </Button>
                    ),
                  })),
                }}
                isSorted={false}
                entriesPerPage={false}
                showTotalEntries={false}
                noEndBorder
                canSearch={false}
              />
            )}
          </MDBox>
        </Card>
      </MDBox>

      {/* content: registrations */}
      <MDBox px={3} pb={3}>
        {regsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          /* mobile cards */
          <Stack spacing={2}>
            {paged.map((r, i) => (
              <Card key={r._id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" mb={1}>
                  <MDTypography variant="subtitle2">#{(page - 1) * perPage + i + 1}</MDTypography>
                  <Chip
                    size="small"
                    color={r.payment.status === "Paid" ? "success" : "default"}
                    label={r.payment.status === "Paid" ? "Đã thanh toán" : "Chưa thanh toán"}
                  />
                </Stack>

                {[r.player1, r.player2].filter(Boolean).map((pl) => (
                  <Stack
                    key={(pl.user || pl.fullName) + (pl.phone || "")}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    mb={1}
                  >
                    <Avatar src={pl.avatar || PLACE} />
                    <Box>
                      <MDTypography variant="body2">{pl.fullName}</MDTypography>
                      <div></div>
                      <MDTypography variant="caption" color="text">
                        {pl.phone}
                      </MDTypography>
                    </Box>
                  </Stack>
                ))}

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <MDTypography variant="caption">
                    {new Date(r.createdAt).toLocaleString()}
                  </MDTypography>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      color={r.payment.status === "Paid" ? "error" : "success"}
                      onClick={() => handleToggle(r)}
                      title={
                        r.payment.status === "Paid"
                          ? "Đánh dấu chưa thanh toán"
                          : "Xác nhận thanh toán"
                      }
                    >
                      {r.payment.status === "Paid" ? <MoneyOff /> : <Paid />}
                    </IconButton>
                    <IconButton color="error" onClick={() => setConfirmDel(r)} title="Xoá đăng ký">
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </Card>
            ))}
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, v) => setPage(v)}
                size="small"
              />
            </Box>
          </Stack>
        ) : (
          /* desktop table */
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
              <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} />
            </MDBox>
          </Card>
        )}
      </MDBox>

      <Footer />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Confirm delete */}
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)}>
        <DialogTitle>Xoá đăng ký?</DialogTitle>
        <DialogContent>
          {isSingles ? (
            <>
              Bạn chắc chắn xoá đăng ký của <b>{confirmDel?.player1?.fullName}</b>?
            </>
          ) : (
            <>
              Bạn chắc chắn xoá cặp&nbsp;
              <b>{confirmDel?.player1?.fullName}</b>
              {confirmDel?.player2 ? (
                <>
                  {" "}
                  — <b>{confirmDel?.player2?.fullName}</b>?
                </>
              ) : (
                "?"
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDel(null)}>Huỷ</Button>
          <Button color="error" onClick={handleDelete}>
            Xoá
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
