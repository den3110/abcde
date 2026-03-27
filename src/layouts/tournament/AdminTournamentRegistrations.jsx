/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack,
  Delete as DeleteIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  MoneyOff,
  Paid,
} from "@mui/icons-material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import {
  useAddTournamentManagerMutation,
  useAdminCreateRegistrationMutation,
  useAdminUpdateRegistrationMutation,
  useDeleteRegistrationMutation,
  useGetRegistrationHistoryQuery,
  useGetRegistrationsQuery,
  useGetTournamentQuery,
  useListTournamentManagersQuery,
  useRemoveTournamentManagerMutation,
  useUpdatePaymentMutation,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";
import { getTournamentNameDisplayMode, getTournamentPlayerName } from "utils/tournamentName";

const PLACE = "";

function normType(eventType) {
  const s = String(eventType || "")
    .trim()
    .toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return s || "double";
}

function toUserOption(userLike) {
  if (!userLike) return null;
  const id = userLike.id || userLike._id || userLike.user;
  if (!id) return null;
  const nickname = userLike.nickname || userLike.nickName || "";
  const name = userLike.name || userLike.fullName || "";
  const phone = userLike.phone || "";
  return {
    id,
    label: `${nickname || name || id}${phone ? ` • ${phone}` : ""}`,
    name,
    nickname,
    phone,
    email: userLike.email || "",
    avatar: userLike.avatar || "",
  };
}

function formatAuditValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatAuditValue).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getActorLabel(item) {
  const actor = item?.actor?.id;
  if (actor?.nickname) return actor.nickname;
  if (actor?.name) return actor.name;
  if (actor?.phone) return actor.phone;
  return item?.actor?.kind || "system";
}

export default function AdminTournamentRegistrations() {
  const { id } = useParams();
  const nav = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { data: tournament, error: tournamentError } = useGetTournamentQuery(id);
  const {
    data: registrations = [],
    isLoading: registrationsLoading,
    error: registrationsError,
    refetch,
  } = useGetRegistrationsQuery(id);
  const {
    data: managers = [],
    isFetching: managersLoading,
    refetch: refetchManagers,
  } = useListTournamentManagersQuery(id);

  const [createRegistration, { isLoading: createLoading }] = useAdminCreateRegistrationMutation();
  const [updateRegistration, { isLoading: updateLoading }] = useAdminUpdateRegistrationMutation();
  const [updatePayment] = useUpdatePaymentMutation();
  const [deleteRegistration] = useDeleteRegistrationMutation();
  const [addManager] = useAddTournamentManagerMutation();
  const [removeManager] = useRemoveTournamentManagerMutation();

  const eventType = normType(tournament?.eventType);
  const isSingles = eventType === "single";
  const displayMode = getTournamentNameDisplayMode(tournament);
  const isFreeTournament = tournament?.isFreeRegistration === true;

  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  const [page, setPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(registrations.length / perPage));
  const paged = useMemo(
    () => registrations.slice((page - 1) * perPage, page * perPage),
    [registrations, page]
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [historyReg, setHistoryReg] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create");
  const [editingReg, setEditingReg] = useState(null);
  const [form, setForm] = useState({
    player1: null,
    player2: null,
    message: "",
    paymentStatus: "Unpaid",
  });
  const [managerKeyword, setManagerKeyword] = useState("");
  const [selectedManager, setSelectedManager] = useState(null);
  const [player1Keyword, setPlayer1Keyword] = useState("");
  const [player2Keyword, setPlayer2Keyword] = useState("");

  const pageIds = useMemo(() => paged.map((r) => r._id), [paged]);
  const selectedOnPageCount = pageIds.filter((regId) => selectedIds.has(regId)).length;
  const allOnPage = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const someOnPage = selectedOnPageCount > 0 && !allOnPage;
  const isEditorBusy = createLoading || updateLoading;

  const { data: historyData, isFetching: historyLoading } = useGetRegistrationHistoryQuery(
    { regId: historyReg?._id, page: historyPage, limit: 10 },
    { skip: !historyReg?._id }
  );

  const { data: managerSearch, isFetching: searchingManagers } = useGetUsersQuery(
    { page: 1, keyword: managerKeyword, role: "" },
    { skip: managerKeyword.trim().length < 1 }
  );
  const { data: player1Search, isFetching: searchingPlayer1 } = useGetUsersQuery(
    { page: 1, keyword: player1Keyword, role: "" },
    { skip: !editorOpen || player1Keyword.trim().length < 1 }
  );
  const { data: player2Search, isFetching: searchingPlayer2 } = useGetUsersQuery(
    { page: 1, keyword: player2Keyword, role: "" },
    { skip: !editorOpen || isSingles || player2Keyword.trim().length < 1 }
  );

  const managerOptions = (managerSearch?.users || []).map(toUserOption);
  const player1Options = (player1Search?.users || []).map(toUserOption);
  const player2Options = (player2Search?.users || []).map(toUserOption);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (tournamentError) {
      showSnack("error", tournamentError?.data?.message || tournamentError.error || "Lỗi tải giải");
    }
  }, [tournamentError]);

  useEffect(() => {
    if (registrationsError) {
      showSnack(
        "error",
        registrationsError?.data?.message || registrationsError.error || "Lỗi tải đăng ký"
      );
    }
  }, [registrationsError]);

  const renderAthlete = (player) => {
    if (!player) {
      return (
        <MDTypography variant="caption" color="text">
          —
        </MDTypography>
      );
    }
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar src={player.avatar || PLACE} />
        <Box>
          <MDTypography variant="button">
            {getTournamentPlayerName(player, displayMode)}
          </MDTypography>
          <div />
          <MDTypography variant="caption" color="text">
            {player.phone || "—"}
          </MDTypography>
        </Box>
      </Stack>
    );
  };

  const resetEditor = () => {
    setEditorOpen(false);
    setEditorMode("create");
    setEditingReg(null);
    setPlayer1Keyword("");
    setPlayer2Keyword("");
    setForm({
      player1: null,
      player2: null,
      message: "",
      paymentStatus: isFreeTournament ? "Paid" : "Unpaid",
    });
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setEditingReg(null);
    setPlayer1Keyword("");
    setPlayer2Keyword("");
    setForm({
      player1: null,
      player2: null,
      message: "",
      paymentStatus: isFreeTournament ? "Paid" : "Unpaid",
    });
    setEditorOpen(true);
  };

  const openEditEditor = (reg) => {
    setEditorMode("edit");
    setEditingReg(reg);
    setPlayer1Keyword("");
    setPlayer2Keyword("");
    setForm({
      player1: toUserOption({
        id: reg?.player1?.user,
        fullName: reg?.player1?.fullName,
        nickName: reg?.player1?.nickName,
        phone: reg?.player1?.phone,
        avatar: reg?.player1?.avatar,
      }),
      player2: reg?.player2
        ? toUserOption({
            id: reg?.player2?.user,
            fullName: reg?.player2?.fullName,
            nickName: reg?.player2?.nickName,
            phone: reg?.player2?.phone,
            avatar: reg?.player2?.avatar,
          })
        : null,
      message: reg?.message || "",
      paymentStatus: isFreeTournament ? "Paid" : reg?.payment?.status || "Unpaid",
    });
    setEditorOpen(true);
  };

  const openHistory = (reg) => {
    setHistoryPage(1);
    setHistoryReg(reg);
  };

  const toggleSelect = (regId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(regId);
      else next.delete(regId);
      return next;
    });
  };

  const toggleSelectAllPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) pageIds.forEach((regId) => next.add(regId));
      else pageIds.forEach((regId) => next.delete(regId));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSaveRegistration = async () => {
    if (!form.player1?.id) {
      showSnack("error", "Thiếu vận động viên 1");
      return;
    }
    if (!isSingles && !form.player2?.id) {
      showSnack("error", "Giải đôi cần 2 vận động viên");
      return;
    }

    const body = {
      player1Id: form.player1.id,
      player2Id: isSingles ? null : form.player2?.id || null,
      message: form.message || "",
      paymentStatus: isFreeTournament ? "Paid" : form.paymentStatus || "Unpaid",
    };

    try {
      if (editorMode === "create") {
        await createRegistration({ tourId: id, body }).unwrap();
        showSnack("success", "Đã thêm đăng ký");
      } else if (editingReg?._id) {
        await updateRegistration({ regId: editingReg._id, body }).unwrap();
        showSnack("success", "Đã cập nhật đăng ký");
      }
      resetEditor();
      refetch();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Lưu đăng ký thất bại");
    }
  };

  const handleTogglePayment = async (reg) => {
    if (isFreeTournament) return;
    const nextStatus = reg.payment?.status === "Paid" ? "Unpaid" : "Paid";
    try {
      await updatePayment({ regId: reg._id, status: nextStatus }).unwrap();
      showSnack(
        "success",
        nextStatus === "Paid" ? "Đã xác nhận thanh toán" : "Đã đặt lại chưa thanh toán"
      );
      refetch();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Cập nhật thanh toán thất bại");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?._id) return;
    try {
      await deleteRegistration(confirmDelete._id).unwrap();
      showSnack("success", "Đã xóa đăng ký");
      setConfirmDelete(null);
      refetch();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Xóa đăng ký thất bại");
    }
  };

  const bulkUpdateStatus = async (status) => {
    if (isFreeTournament) return;
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      setBulkWorking(true);
      await Promise.all(ids.map((regId) => updatePayment({ regId, status }).unwrap()));
      showSnack(
        "success",
        status === "Paid"
          ? "Đã xác nhận thanh toán cho mục đã chọn"
          : "Đã đặt lại chưa thanh toán cho mục đã chọn"
      );
      clearSelection();
      refetch();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Cập nhật hàng loạt thất bại");
    } finally {
      setBulkWorking(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      setBulkWorking(true);
      await Promise.all(ids.map((regId) => deleteRegistration(regId).unwrap()));
      showSnack("success", "Đã xóa các đăng ký đã chọn");
      clearSelection();
      setConfirmBulkDelete(false);
      refetch();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Xóa hàng loạt thất bại");
    } finally {
      setBulkWorking(false);
    }
  };

  const handleAddManager = async () => {
    if (!selectedManager?.id) return;
    try {
      await addManager({ tournamentId: id, userId: selectedManager.id }).unwrap();
      showSnack("success", "Đã thêm người quản lý");
      setSelectedManager(null);
      setManagerKeyword("");
      refetchManagers();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Thêm người quản lý thất bại");
    }
  };

  const handleRemoveManager = async (userId) => {
    try {
      await removeManager({ tournamentId: id, userId }).unwrap();
      showSnack("success", "Đã xóa người quản lý");
      refetchManagers();
    } catch (error) {
      showSnack("error", error?.data?.message || error.error || "Xóa người quản lý thất bại");
    }
  };

  const columns = useMemo(() => {
    const selectHeader = (
      <Box display="flex" justifyContent="center" alignItems="center">
        <Checkbox
          size="small"
          indeterminate={someOnPage}
          checked={allOnPage}
          onChange={(e) => toggleSelectAllPage(e.target.checked)}
        />
      </Box>
    );

    const base = [
      { Header: selectHeader, accessor: "select", align: "center", width: "6%" },
      { Header: "#", accessor: "index", align: "center", width: "6%" },
      { Header: isSingles ? "Vận động viên" : "Vận động viên 1", accessor: "player1" },
    ];
    if (!isSingles) base.push({ Header: "Vận động viên 2", accessor: "player2" });
    base.push(
      { Header: "Ngày đăng ký", accessor: "createdAt" },
      { Header: "Thao tác", accessor: "actions", align: "center" }
    );
    if (!isFreeTournament) {
      base.splice(base.length - 1, 0, {
        Header: "Thanh toán",
        accessor: "payment",
        align: "center",
      });
    }
    return base;
  }, [isSingles, someOnPage, allOnPage, isFreeTournament]);

  const rows = useMemo(
    () =>
      paged.map((reg, idx) => ({
        select: (
          <Checkbox
            size="small"
            checked={selectedIds.has(reg._id)}
            onChange={(e) => toggleSelect(reg._id, e.target.checked)}
          />
        ),
        index: <MDTypography variant="caption">{(page - 1) * perPage + idx + 1}</MDTypography>,
        player1: renderAthlete(reg.player1),
        ...(isSingles ? {} : { player2: renderAthlete(reg.player2) }),
        createdAt: (
          <Stack spacing={0.5}>
            <MDTypography variant="caption">
              {new Date(reg.createdAt).toLocaleString()}
            </MDTypography>
            <MDTypography variant="caption" color="text">
              Mã #{reg.code || "—"}
            </MDTypography>
          </Stack>
        ),
        ...(isFreeTournament
          ? {}
          : {
              payment: (
                <Stack spacing={0.5} alignItems="center">
                  <Chip
                    size="small"
                    color={reg.payment?.status === "Paid" ? "success" : "default"}
                    label={reg.payment?.status === "Paid" ? "Đã thanh toán" : "Chưa thanh toán"}
                  />
                  {reg.payment?.paidAt ? (
                    <MDTypography variant="caption" color="text">
                      {new Date(reg.payment.paidAt).toLocaleString()}
                    </MDTypography>
                  ) : null}
                </Stack>
              ),
            }),
        actions: (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Tooltip title="Sửa đăng ký">
              <IconButton color="info" onClick={() => openEditEditor(reg)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Lịch sử thay đổi">
              <IconButton color="secondary" onClick={() => openHistory(reg)}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            {!isFreeTournament ? (
              <Tooltip
                title={
                  reg.payment?.status === "Paid"
                    ? "Đánh dấu chưa thanh toán"
                    : "Xác nhận thanh toán"
                }
              >
                <IconButton
                  color={reg.payment?.status === "Paid" ? "error" : "success"}
                  onClick={() => handleTogglePayment(reg)}
                >
                  {reg.payment?.status === "Paid" ? <MoneyOff /> : <Paid />}
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title="Xóa đăng ký">
              <IconButton color="error" onClick={() => setConfirmDelete(reg)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      })),
    [paged, page, isSingles, selectedIds, isFreeTournament]
  );

  const renderManagerTable = () => (
    <DataTable
      table={{
        columns: [
          { Header: "Người quản lý", accessor: "user", align: "left" },
          { Header: "Liên hệ", accessor: "contact", align: "left" },
          { Header: "Thao tác", accessor: "actions", align: "center", width: "10%" },
        ],
        rows: (managers || []).map((manager) => ({
          user: (
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar src={manager.user?.avatar || ""} />
              <Box>
                <MDTypography variant="button">
                  {manager.user?.nickname || manager.user?.name || "—"}
                </MDTypography>
                <div />
                <MDTypography variant="caption" color="text">
                  ID: {manager.user?._id}
                </MDTypography>
              </Box>
            </Stack>
          ),
          contact: (
            <MDTypography variant="caption" color="text">
              {manager.user?.phone || "—"} • {manager.user?.email || "—"}
            </MDTypography>
          ),
          actions: (
            <Button
              size="small"
              color="error"
              variant="outlined"
              sx={{ color: "error.main" }}
              onClick={() => {
                const label =
                  manager?.user?.nickname ||
                  manager?.user?.name ||
                  manager?.user?.phone ||
                  manager?.user?._id;
                if (window.confirm(`Xóa người quản lý "${label}"?`)) {
                  handleRemoveManager(manager.user?._id);
                }
              }}
            >
              Xóa
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
  );

  const renderRegistrationCards = () => (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Checkbox
          size="small"
          indeterminate={someOnPage}
          checked={allOnPage}
          onChange={(e) => toggleSelectAllPage(e.target.checked)}
        />
        <Typography variant="body2">Chọn tất cả trang này</Typography>
      </Stack>
      {paged.map((reg, idx) => (
        <Card key={reg._id} sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Checkbox
                size="small"
                checked={selectedIds.has(reg._id)}
                onChange={(e) => toggleSelect(reg._id, e.target.checked)}
              />
              <MDTypography variant="subtitle2">#{(page - 1) * perPage + idx + 1}</MDTypography>
            </Stack>
            <Chip
              size="small"
              color={
                isFreeTournament ? "info" : reg.payment?.status === "Paid" ? "success" : "default"
              }
              label={
                isFreeTournament
                  ? "Miễn phí"
                  : reg.payment?.status === "Paid"
                  ? "Đã thanh toán"
                  : "Chưa thanh toán"
              }
            />
          </Stack>
          <Stack spacing={1.5}>
            {renderAthlete(reg.player1)}
            {!isSingles && reg.player2 ? renderAthlete(reg.player2) : null}
          </Stack>
          <Stack spacing={0.5} mt={1.5}>
            <MDTypography variant="caption" color="text">
              Mã #{reg.code || "—"}
            </MDTypography>
            <MDTypography variant="caption" color="text">
              Ngày đăng ký: {new Date(reg.createdAt).toLocaleString()}
            </MDTypography>
            {!isFreeTournament && reg.payment?.paidAt ? (
              <MDTypography variant="caption" color="text">
                Thanh toán lúc: {new Date(reg.payment.paidAt).toLocaleString()}
              </MDTypography>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => openEditEditor(reg)}>
              Sửa
            </Button>
            <Button size="small" variant="outlined" onClick={() => openHistory(reg)}>
              Lịch sử
            </Button>
            {!isFreeTournament ? (
              <Button
                size="small"
                variant="outlined"
                color={reg.payment?.status === "Paid" ? "warning" : "success"}
                onClick={() => handleTogglePayment(reg)}
              >
                {reg.payment?.status === "Paid" ? "Đặt chưa thanh toán" : "Xác nhận thanh toán"}
              </Button>
            ) : null}
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => setConfirmDelete(reg)}
            >
              Xóa
            </Button>
          </Stack>
        </Card>
      ))}
      <Box display="flex" justifyContent="center" mt={2}>
        <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} size="small" />
      </Box>
    </Stack>
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
            {!isFreeTournament ? (
              <>
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
              </>
            ) : null}
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={bulkWorking}
              onClick={() => setConfirmBulkDelete(true)}
            >
              Xóa đăng ký
            </Button>
            <Button size="small" onClick={clearSelection} disabled={bulkWorking}>
              Bỏ chọn
            </Button>
          </Stack>
        </Stack>
      </Paper>
    ) : null;

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <MDBox px={3} pt={3}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <IconButton onClick={() => nav(-1)} aria-label="Quay lại">
            <ArrowBack />
          </IconButton>
          <MDTypography variant="h5">Danh sách đăng ký</MDTypography>
          <Box flexGrow={1} />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateEditor}
            sx={{ color: "white !important" }}
          >
            Thêm đăng ký
          </Button>
          <Button
            variant="outlined"
            startIcon={<SmartToyIcon />}
            onClick={() => nav(`/admin/ai-registration-import?t=${encodeURIComponent(id)}`)}
          >
            AI Import
          </Button>
        </Stack>
        {tournament ? (
          <Typography variant="caption" color="text.secondary" fontSize={16}>
            {tournament.name} • {new Date(tournament.startDate).toLocaleDateString()} –{" "}
            {new Date(tournament.endDate).toLocaleDateString()} •{" "}
            {isSingles ? "Giải đơn" : "Giải đôi"}
          </Typography>
        ) : null}
      </MDBox>
      <MDBox px={3} pt={1} pb={2}>
        <Card>
          <MDBox p={2}>
            <MDTypography variant="h6">Quản lý đăng ký giải đấu</MDTypography>
            <Typography variant="caption" color="text.secondary">
              Thêm người quản lý: có quyền xác nhận thanh toán, sửa và xóa đăng ký cho giải này.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              mt={2}
            >
              <Autocomplete
                fullWidth
                value={selectedManager}
                onChange={(_, value) => setSelectedManager(value)}
                onInputChange={(_, value) => setManagerKeyword(value)}
                options={managerOptions}
                loading={searchingManagers}
                filterOptions={(x) => x}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Tìm người dùng theo tên / email" />
                )}
              />
              <Button
                variant="contained"
                onClick={handleAddManager}
                disabled={!selectedManager}
                sx={{ color: "white !important" }}
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
              renderManagerTable()
            )}
          </MDBox>
        </Card>
      </MDBox>

      <MDBox px={3} pb={8}>
        {registrationsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          renderRegistrationCards()
        ) : (
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
      <BulkBar />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>

      <Dialog open={editorOpen} onClose={resetEditor} maxWidth="md" fullWidth>
        <DialogTitle>
          {editorMode === "create" ? "Thêm đăng ký giải" : "Sửa đăng ký giải"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Autocomplete
              value={form.player1}
              onChange={(_, value) => setForm((prev) => ({ ...prev, player1: value }))}
              onInputChange={(_, value) => setPlayer1Keyword(value)}
              options={player1Options}
              filterOptions={(x) => x}
              loading={searchingPlayer1}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Vận động viên 1" />}
            />
            {!isSingles ? (
              <Autocomplete
                value={form.player2}
                onChange={(_, value) => setForm((prev) => ({ ...prev, player2: value }))}
                onInputChange={(_, value) => setPlayer2Keyword(value)}
                options={player2Options}
                filterOptions={(x) => x}
                loading={searchingPlayer2}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Vận động viên 2" />}
              />
            ) : null}
            <TextField
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              label="Ghi chú"
              multiline
              minRows={3}
            />
            {isFreeTournament ? (
              <Alert severity="info">
                Giải này miễn phí, đăng ký mới sẽ tự ở trạng thái đã thanh toán.
              </Alert>
            ) : (
              <TextField
                select
                label="Thanh toán"
                SelectProps={{ native: true }}
                value={form.paymentStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
              >
                <option value="Unpaid">Chưa thanh toán</option>
                <option value="Paid">Đã thanh toán</option>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetEditor}>Hủy</Button>
          <Button onClick={handleSaveRegistration} variant="contained" disabled={isEditorBusy}>
            {isEditorBusy ? "Đang lưu..." : editorMode === "create" ? "Thêm" : "Cập nhật"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!historyReg} onClose={() => setHistoryReg(null)} maxWidth="md" fullWidth>
        <DialogTitle>Lịch sử đăng ký {historyReg?.code ? `#${historyReg.code}` : ""}</DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : historyData?.items?.length ? (
            <Stack spacing={2} mt={1}>
              {historyData.items.map((item) => (
                <Card key={item._id} sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        size="small"
                        color={
                          item.action === "DELETE"
                            ? "error"
                            : item.action === "CREATE"
                            ? "success"
                            : "info"
                        }
                        label={item.action}
                      />
                      <Typography variant="body2">{getActorLabel(item)}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.createdAt).toLocaleString()}
                    </Typography>
                  </Stack>
                  {item.note ? (
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      {item.note}
                    </Typography>
                  ) : null}
                  <Stack spacing={1}>
                    {(item.changes || []).map((change, idx) => (
                      <Box key={`${item._id}-${idx}`}>
                        <Typography variant="caption" color="text.secondary">
                          {change.field}
                        </Typography>
                        <Typography variant="body2">
                          <b>Từ:</b> {formatAuditValue(change.from)}
                        </Typography>
                        <Typography variant="body2">
                          <b>Sang:</b> {formatAuditValue(change.to)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" mt={1}>
              Chưa có lịch sử thay đổi cho đăng ký này.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Pagination
            count={Math.max(1, historyData?.pages || 1)}
            page={historyPage}
            onChange={(_, value) => setHistoryPage(value)}
            size="small"
          />
          <Button onClick={() => setHistoryReg(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Xóa đăng ký?</DialogTitle>
        <DialogContent>
          {isSingles ? (
            <>
              Bạn chắc chắn xóa đăng ký của{" "}
              <b>{getTournamentPlayerName(confirmDelete?.player1, displayMode)}</b>?
            </>
          ) : (
            <>
              Bạn chắc chắn xóa cặp{" "}
              <b>{getTournamentPlayerName(confirmDelete?.player1, displayMode)}</b>
              {confirmDelete?.player2 ? (
                <>
                  {" "}
                  — <b>{getTournamentPlayerName(confirmDelete?.player2, displayMode)}</b>?
                </>
              ) : (
                "?"
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Hủy</Button>
          <Button color="error" onClick={handleDelete}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)}>
        <DialogTitle>Xóa {selectedIds.size} đăng ký đã chọn?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmBulkDelete(false)}>Hủy</Button>
          <Button color="error" onClick={bulkDelete} disabled={bulkWorking}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
