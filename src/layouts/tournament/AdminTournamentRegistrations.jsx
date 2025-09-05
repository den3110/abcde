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
  Checkbox,
  Paper,
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

  /* ───── mutations ───── */
  const [updatePay] = useUpdatePaymentMutation();
  const [deleteReg] = useDeleteRegistrationMutation();
  const [addManager] = useAddTournamentManagerMutation();
  const [removeManager] = useRemoveTournamentManagerMutation();

  const [confirmDel, setConfirmDel] = useState(null); // reg obj or null
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);

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

  /* ───── selection (per reg._id) ───── */
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const pageIds = useMemo(() => paged.map((r) => r._id), [paged]);
  const selectedOnPageCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const allOnPage = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const someOnPage = selectedOnPageCount > 0 && !allOnPage;

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) pageIds.forEach((id) => next.add(id));
      else pageIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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
    { skip: mgrKeyword.trim().length < 1 }
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

  /* ───── Bulk actions ───── */
  const [bulkWorking, setBulkWorking] = useState(false);

  const bulkUpdateStatus = async (status) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBulkWorking(true);
      await Promise.all(ids.map((regId) => updatePay({ regId, status }).unwrap()));
      showSnack(
        "success",
        status === "Paid"
          ? "Đã xác nhận thanh toán cho mục đã chọn"
          : "Đã đặt về chưa thanh toán cho mục đã chọn"
      );
      clearSelection();
      refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Cập nhật hàng loạt thất bại");
    } finally {
      setBulkWorking(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBulkWorking(true);
      await Promise.all(ids.map((regId) => deleteReg(regId).unwrap()));
      showSnack("success", "Đã xoá các đăng ký đã chọn");
      clearSelection();
      refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Xoá hàng loạt thất bại");
    } finally {
      setBulkWorking(false);
      setConfirmBulkDel(false);
    }
  };

  /* ───── DataTable config (desktop) ───── */
  const columns = useMemo(() => {
    const selHeader = (
      <Box display="flex" justifyContent="center" alignItems="center">
        <Checkbox
          size="small"
          indeterminate={someOnPage}
          checked={allOnPage}
          onChange={(e) => toggleSelectAllPage(e.target.checked)}
          inputProps={{ "aria-label": "Chọn tất cả trang này" }}
        />
      </Box>
    );

    const base = [
      { Header: selHeader, accessor: "sel", align: "center", width: "6%" },
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
  }, [isSingles, someOnPage, allOnPage, pageIds]);

  const rows = useMemo(
    () =>
      paged.map((r, i) => ({
        sel: (
          <Checkbox
            size="small"
            checked={selectedIds.has(r._id)}
            onChange={(e) => toggleSelect(r._id, e.target.checked)}
            inputProps={{ "aria-label": `Chọn đăng ký ${r._id}` }}
          />
        ),
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
    [paged, page, isSingles, selectedIds]
  );

  const BulkBar = () =>
    selectedIds.size > 0 ? (
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (t) => t.zIndex.drawer + 1,
          borderTop: "1px solid",
          borderColor: "divider",
          p: 1.5,
          backdropFilter: "saturate(180%) blur(8px)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">
            Đã chọn <b>{selectedIds.size}</b> đăng ký
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              size="small"
              variant="contained"
              startIcon={<Paid />}
              disabled={bulkWorking}
              onClick={() => bulkUpdateStatus("Paid")}
            >
              Tất cả thanh toán
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MoneyOff />}
              disabled={bulkWorking}
              onClick={() => bulkUpdateStatus("Unpaid")}
            >
              Tất cả chưa thanh toán
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={bulkWorking}
              onClick={() => setConfirmBulkDel(true)}
            >
              Xoá đăng ký
            </Button>
            <Button size="small" onClick={clearSelection} disabled={bulkWorking}>
              Bỏ chọn
            </Button>
          </Stack>
        </Stack>
      </Paper>
    ) : null;

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
                filterOptions={(x) => x}
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
      <MDBox px={3} pb={8 /* chừa chỗ cho BulkBar */}>
        {regsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          <>
            {/* Select all (mobile) */}
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Checkbox
                size="small"
                indeterminate={someOnPage}
                checked={allOnPage}
                onChange={(e) => toggleSelectAllPage(e.target.checked)}
              />
              <Typography variant="body2">Chọn tất cả trang này</Typography>
            </Stack>

            {/* mobile cards */}
            <Stack spacing={2}>
              {paged.map((r, i) => (
                <Card key={r._id} sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" mb={1} alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Checkbox
                        size="small"
                        checked={selectedIds.has(r._id)}
                        onChange={(e) => toggleSelect(r._id, e.target.checked)}
                      />
                      <MDTypography variant="subtitle2">
                        #{(page - 1) * perPage + i + 1}
                      </MDTypography>
                    </Stack>
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
                      <IconButton
                        color="error"
                        onClick={() => setConfirmDel(r)}
                        title="Xoá đăng ký"
                      >
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
          </>
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

      {/* Bulk action bar */}
      <BulkBar />

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

      {/* Confirm delete (single) */}
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

      {/* Confirm delete (bulk) */}
      <Dialog open={confirmBulkDel} onClose={() => setConfirmBulkDel(false)}>
        <DialogTitle>Xoá {selectedIds.size} đăng ký đã chọn?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmBulkDel(false)}>Huỷ</Button>
          <Button color="error" onClick={bulkDelete} disabled={bulkWorking}>
            Xoá
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
