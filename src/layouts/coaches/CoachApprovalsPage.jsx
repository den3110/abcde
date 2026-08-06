// layouts/coaches/CoachApprovalsPage.jsx
// Admin duyệt đơn HLV + thành tích. 2 tab: Applications | Achievements.
import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Snackbar,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import {
  useListCoachApplicationsQuery,
  useApproveCoachApplicationMutation,
  useRejectCoachApplicationMutation,
  useListCoachAchievementsQuery,
  useApproveCoachAchievementMutation,
  useRejectCoachAchievementMutation,
  usePatchCoachAchievementMutation,
} from "slices/adminApiSlice";

const LEVEL_LABEL = {
  national: "Quốc gia",
  regional: "Khu vực",
  local: "Địa phương",
  club: "CLB",
  other: "Khác",
};
const STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  cancelled: "default",
};

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN") : "-";

function ApplicationCard({ app, onApprove, onReject }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("approve"); // 'approve' | 'reject'

  const doAction = () => {
    if (mode === "approve") onApprove(app._id, note);
    else onReject(app._id, note);
    setNoteOpen(false);
    setNote("");
  };

  const u = app.user || {};
  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar src={u.avatar} sx={{ width: 48, height: 48 }}>
              {(u.nickname || u.name || "?")[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="subtitle1" fontWeight={700}>
                  {u.name || u.nickname}
                </Typography>
                {u.nickname && (
                  <Typography variant="caption" color="text.secondary">
                    @{u.nickname}
                  </Typography>
                )}
                <Chip
                  size="small"
                  color={STATUS_COLOR[app.status]}
                  label={app.status}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {u.phone || "—"} · {u.province || "—"} · Gửi lúc {fmt(app.createdAt)}
              </Typography>

              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {app.headline || "(không có headline)"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Kinh nghiệm: {app.experienceYears} năm · Giá:{" "}
                  {app.hourlyRate ? `${app.hourlyRate.toLocaleString()}₫/h` : "—"}
                </Typography>
                {app.bio && (
                  <Typography
                    variant="body2"
                    sx={{ mt: 1, whiteSpace: "pre-wrap" }}
                  >
                    {app.bio}
                  </Typography>
                )}
                {app.specialties?.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {app.specialties.map((s) => (
                      <Chip key={s} size="small" label={s} variant="outlined" />
                    ))}
                  </Stack>
                )}
              </Box>

              {app.proposedAchievements?.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" fontWeight={700}>
                    Thành tích đề xuất ({app.proposedAchievements.length}):
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {app.proposedAchievements.map((a, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: "action.hover",
                          fontSize: 13,
                        }}
                      >
                        <Typography variant="body2" fontWeight={600}>
                          {a.title}{" "}
                          {a.year ? (
                            <Chip
                              size="small"
                              label={a.year}
                              sx={{ ml: 0.5, height: 18, fontSize: 10 }}
                            />
                          ) : null}
                          <Chip
                            size="small"
                            label={LEVEL_LABEL[a.level] || "Khác"}
                            sx={{ ml: 0.5, height: 18, fontSize: 10 }}
                          />
                        </Typography>
                        {a.description && (
                          <Typography variant="caption" color="text.secondary">
                            {a.description}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {app.note && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block", fontStyle: "italic" }}
                >
                  Ghi chú user: {app.note}
                </Typography>
              )}

              {app.status === "pending" && (
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckIcon />}
                    size="small"
                    onClick={() => {
                      setMode("approve");
                      setNoteOpen(true);
                    }}
                  >
                    Duyệt
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    size="small"
                    onClick={() => {
                      setMode("reject");
                      setNoteOpen(true);
                    }}
                  >
                    Từ chối
                  </Button>
                </Stack>
              )}

              {app.status !== "pending" && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block" }}
                >
                  Xử lý bởi{" "}
                  {app.reviewedBy?.name || app.reviewedBy?.nickname || "-"} lúc{" "}
                  {fmt(app.reviewedAt)}
                  {app.adminNote ? ` · "${app.adminNote}"` : ""}
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={noteOpen} onClose={() => setNoteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {mode === "approve" ? "Duyệt đơn HLV" : "Từ chối đơn HLV"}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {mode === "approve"
              ? "Sau khi duyệt: user sẽ được set isCoach=true, hồ sơ xuất hiện trong /coaches, các thành tích đề xuất sẽ được tạo với status approved."
              : "Ghi rõ lý do để user hiểu và có thể chỉnh sửa lại."}
          </Typography>
          <TextField
            label="Ghi chú admin (tuỳ chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteOpen(false)}>Huỷ</Button>
          <Button
            variant="contained"
            color={mode === "approve" ? "success" : "error"}
            onClick={doAction}
          >
            {mode === "approve" ? "Duyệt" : "Từ chối"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function AchievementRow({ ach, onApprove, onReject, onEdit }) {
  const u = ach.coach || {};
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar src={u.avatar} sx={{ width: 40, height: 40 }}>
            {(u.nickname || u.name || "?")[0]?.toUpperCase()}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" fontWeight={700}>
                {u.name || u.nickname}
              </Typography>
              <Chip size="small" color={STATUS_COLOR[ach.status]} label={ach.status} />
              {ach.year && <Chip size="small" label={ach.year} variant="outlined" />}
              <Chip
                size="small"
                label={LEVEL_LABEL[ach.level] || "Khác"}
                variant="outlined"
              />
            </Stack>
            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
              {ach.title}
            </Typography>
            {ach.description && (
              <Typography variant="body2" color="text.secondary">
                {ach.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Gửi lúc {fmt(ach.createdAt)}
              {ach.adminNote ? ` · Admin: "${ach.adminNote}"` : ""}
            </Typography>

            {ach.status === "pending" && (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<CheckIcon />}
                  onClick={() => onApprove(ach._id)}
                >
                  Duyệt
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<CloseIcon />}
                  onClick={() => onReject(ach._id)}
                >
                  Từ chối
                </Button>
                <IconButton size="small" onClick={() => onEdit(ach)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EditAchievementDialog({ open, ach, onClose, onSave }) {
  const [form, setForm] = useState({});
  const currentAch = ach || {};
  const merged = { ...currentAch, ...form };

  const handleChange = (k, v) => setForm({ ...form, [k]: v });
  const handleSave = () => {
    onSave(currentAch._id, form);
    onClose();
    setForm({});
  };

  if (!ach) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chỉnh sửa thành tích</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Tên thành tích"
            value={merged.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Năm"
              type="number"
              value={merged.year || ""}
              onChange={(e) => handleChange("year", e.target.value)}
              sx={{ width: 140 }}
            />
            <Select
              value={merged.level || "other"}
              onChange={(e) => handleChange("level", e.target.value)}
              fullWidth
            >
              {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </Stack>
          <TextField
            label="Mô tả"
            value={merged.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            multiline
            minRows={3}
          />
          <Select
            value={merged.status || "pending"}
            onChange={(e) => handleChange("status", e.target.value)}
          >
            <MenuItem value="pending">Chờ duyệt</MenuItem>
            <MenuItem value="approved">Đã duyệt</MenuItem>
            <MenuItem value="rejected">Từ chối</MenuItem>
          </Select>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" onClick={handleSave}>
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CoachApprovalsPage() {
  const [tab, setTab] = useState(0);
  const [appStatus, setAppStatus] = useState("pending");
  const [achStatus, setAchStatus] = useState("pending");
  const [editAch, setEditAch] = useState(null);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const {
    data: appsData,
    isFetching: appsLoading,
    refetch: refetchApps,
  } = useListCoachApplicationsQuery({ status: appStatus, limit: 50 });
  const {
    data: achsData,
    isFetching: achsLoading,
    refetch: refetchAchs,
  } = useListCoachAchievementsQuery(
    { status: achStatus, limit: 50 },
    { skip: tab !== 1 }
  );

  const [approveApp] = useApproveCoachApplicationMutation();
  const [rejectApp] = useRejectCoachApplicationMutation();
  const [approveAch] = useApproveCoachAchievementMutation();
  const [rejectAch] = useRejectCoachAchievementMutation();
  const [patchAch] = usePatchCoachAchievementMutation();

  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  const handleApproveApp = async (id, adminNote) => {
    try {
      await approveApp({ id, adminNote }).unwrap();
      showSnack("success", "Đã duyệt HLV");
    } catch (err) {
      showSnack("error", err?.data?.message || "Lỗi");
    }
  };
  const handleRejectApp = async (id, adminNote) => {
    try {
      await rejectApp({ id, adminNote }).unwrap();
      showSnack("success", "Đã từ chối");
    } catch (err) {
      showSnack("error", err?.data?.message || "Lỗi");
    }
  };
  const handleApproveAch = async (id) => {
    try {
      await approveAch({ id }).unwrap();
      showSnack("success", "Đã duyệt thành tích");
    } catch (err) {
      showSnack("error", err?.data?.message || "Lỗi");
    }
  };
  const handleRejectAch = async (id) => {
    const note = window.prompt("Lý do từ chối (không bắt buộc)?", "");
    if (note === null) return;
    try {
      await rejectAch({ id, adminNote: note }).unwrap();
      showSnack("success", "Đã từ chối");
    } catch (err) {
      showSnack("error", err?.data?.message || "Lỗi");
    }
  };
  const handleSaveAch = async (id, patch) => {
    try {
      await patchAch({ id, ...patch }).unwrap();
      showSnack("success", "Đã lưu");
    } catch (err) {
      showSnack("error", err?.data?.message || "Lỗi");
    }
  };

  const apps = appsData?.items || [];
  const achs = achsData?.items || [];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2} display="flex" alignItems="center" justifyContent="space-between">
          <MDTypography variant="h4" fontWeight="bold">
            Duyệt Huấn luyện viên
          </MDTypography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => (tab === 0 ? refetchApps() : refetchAchs())}
          >
            Làm mới
          </Button>
        </MDBox>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Đơn đăng ký HLV" />
          <Tab label="Thành tích bổ sung" />
        </Tabs>

        {tab === 0 && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {["pending", "approved", "rejected", "cancelled"].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  color={appStatus === s ? "primary" : "default"}
                  onClick={() => setAppStatus(s)}
                  variant={appStatus === s ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            {appsLoading ? (
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : apps.length === 0 ? (
              <Alert severity="info">Không có đơn</Alert>
            ) : (
              <Stack spacing={2}>
                {apps.map((app) => (
                  <ApplicationCard
                    key={app._id}
                    app={app}
                    onApprove={handleApproveApp}
                    onReject={handleRejectApp}
                  />
                ))}
              </Stack>
            )}
          </>
        )}

        {tab === 1 && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {["pending", "approved", "rejected"].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  color={achStatus === s ? "primary" : "default"}
                  onClick={() => setAchStatus(s)}
                  variant={achStatus === s ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            {achsLoading ? (
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : achs.length === 0 ? (
              <Alert severity="info">Không có thành tích</Alert>
            ) : (
              <Stack spacing={1.5}>
                {achs.map((ach) => (
                  <AchievementRow
                    key={ach._id}
                    ach={ach}
                    onApprove={handleApproveAch}
                    onReject={handleRejectAch}
                    onEdit={setEditAch}
                  />
                ))}
              </Stack>
            )}
          </>
        )}
      </MDBox>

      <EditAchievementDialog
        open={!!editAch}
        ach={editAch}
        onClose={() => setEditAch(null)}
        onSave={handleSaveAch}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert severity={snack.type}>{snack.msg}</Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
