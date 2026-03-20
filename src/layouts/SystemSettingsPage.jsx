import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Fab,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import {
  useDisconnectRecordingDriveMutation,
  useGetRecordingDriveStatusQuery,
  useGetSystemSettingsQuery,
  useLazyRecordingDriveOAuthInitQuery,
  useUpdateSystemSettingsMutation,
} from "slices/settingsApiSlice";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const Section = ({ title, children, desc }) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={1}>
      <Typography variant="h6" fontWeight={700}>
        {title}
      </Typography>
      {desc ? (
        <Typography variant="body2" color="text.secondary">
          {desc}
        </Typography>
      ) : null}
      <Divider />
      <Stack spacing={2} sx={{ pt: 1 }}>
        {children}
      </Stack>
    </Stack>
  </Paper>
);

Section.propTypes = {
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  desc: PropTypes.node,
};

Section.defaultProps = {
  children: null,
  desc: null,
};

function SectionSkeleton({ lines = 3 }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Skeleton variant="text" width={180} height={28} />
        <Skeleton variant="text" width="60%" height={18} />
        <Divider />
        <Stack spacing={1.25} sx={{ pt: 1 }}>
          {Array.from({ length: lines }).map((_, index) => (
            <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Skeleton variant="text" width={200} height={20} />
              <Skeleton variant="rounded" width="40%" height={40} />
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

SectionSkeleton.propTypes = {
  lines: PropTypes.number,
};

SectionSkeleton.defaultProps = {
  lines: 3,
};

const getInitialRecordingDriveMode = (value) =>
  value === "oauthUser" ? "oauthUser" : "serviceAccount";

export default function SystemSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSystemSettingsQuery();
  const {
    data: recordingDriveStatus,
    isFetching: isRecordingDriveStatusLoading,
    refetch: refetchRecordingDriveStatus,
  } = useGetRecordingDriveStatusQuery();
  const [getRecordingDriveOAuthInit, { isFetching: isRecordingDriveConnecting }] =
    useLazyRecordingDriveOAuthInitQuery();
  const [disconnectRecordingDrive, { isLoading: isRecordingDriveDisconnecting }] =
    useDisconnectRecordingDriveMutation();
  const [updateSettings, { isLoading: isSaving }] = useUpdateSystemSettingsMutation();

  const [form, setForm] = useState(null);
  const [showFab, setShowFab] = useState(false);
  const topSaveRef = useRef(null);
  const recordingDrivePopupRef = useRef(null);

  const buildSettingsPayload = (source) => ({
    maintenance: {
      enabled: !!source.maintenance?.enabled,
      message: source.maintenance?.message ?? "",
    },
    registration: {
      open: !!source.registration?.open,
      requireOptionalProfileFields: !!source.registration?.requireOptionalProfileFields,
    },
    kyc: {
      enabled: !!source.kyc?.enabled,
      autoApprove: !!source.kyc?.autoApprove,
      faceMatchThreshold: source.kyc?.faceMatchThreshold ?? 0.78,
    },
    security: {
      enforce2FAForAdmins: !!source.security?.enforce2FAForAdmins,
      sessionTTLHours: source.security?.sessionTTLHours ?? 72,
    },
    uploads: {
      maxAvatarSizeMB: source.uploads?.maxAvatarSizeMB ?? 5,
      avatarLogoEnabled: !!source.uploads?.avatarLogoEnabled,
    },
    notifications: {
      telegramEnabled: !!source.notifications?.telegramEnabled,
      telegramComplaintChatId: source.notifications?.telegramComplaintChatId ?? "",
      systemPushEnabled: !!source.notifications?.systemPushEnabled,
    },
    links: {
      guideUrl: source.links?.guideUrl ?? "",
    },
    ota: {
      forceUpdateEnabled: !!source.ota?.forceUpdateEnabled,
    },
    recordingDrive: {
      enabled: !!source.recordingDrive?.enabled,
      mode: getInitialRecordingDriveMode(source.recordingDrive?.mode),
      folderId: source.recordingDrive?.folderId ?? "",
      sharedDriveId: source.recordingDrive?.sharedDriveId ?? "",
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      ...structuredClone(data),
      recordingDrive: {
        enabled: data.recordingDrive?.enabled ?? true,
        mode: getInitialRecordingDriveMode(data.recordingDrive?.mode),
        folderId: data.recordingDrive?.folderId ?? "",
        sharedDriveId: data.recordingDrive?.sharedDriveId ?? "",
      },
    });
  }, [data]);

  useEffect(() => {
    const handleRecordingDriveAuthDone = (event) => {
      if (event.data?.type !== "recording-drive-auth-done") return;
      if (recordingDrivePopupRef.current && !recordingDrivePopupRef.current.closed) {
        try {
          recordingDrivePopupRef.current.close();
        } catch (_) {}
      }
      recordingDrivePopupRef.current = null;
      refetch();
      refetchRecordingDriveStatus();
      if (event.data?.ok) {
        toast.success("Da ket noi Google Drive cho recording.");
      } else {
        toast.error(event.data?.message || "Ket noi Google Drive that bai.");
      }
    };

    window.addEventListener("message", handleRecordingDriveAuthDone);
    return () => window.removeEventListener("message", handleRecordingDriveAuthDone);
  }, [refetchRecordingDriveStatus]);

  useEffect(() => {
    if (isLoading || !topSaveRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFab(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(topSaveRef.current);
    return () => observer.disconnect();
  }, [isLoading, form]);

  const persistSettings = async (source, { showSuccessToast = true } = {}) => {
    const payload = buildSettingsPayload(source);
    await updateSettings(payload).unwrap();
    if (showSuccessToast) {
      toast.success("Da luu cai dat he thong");
    }
    refetch();
    refetchRecordingDriveStatus();
  };

  const onToggle = (path) => (event) => {
    const checked = event.target.checked;
    setForm((prev) => {
      const next = structuredClone(prev);
      const segments = path.split(".");
      let cursor = next;
      for (let i = 0; i < segments.length - 1; i += 1) {
        if (!cursor[segments[i]]) cursor[segments[i]] = {};
        cursor = cursor[segments[i]];
      }
      cursor[segments.at(-1)] = checked;
      return next;
    });
  };

  const onChange = (path) => (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const next = structuredClone(prev);
      const segments = path.split(".");
      let cursor = next;
      for (let i = 0; i < segments.length - 1; i += 1) {
        if (!cursor[segments[i]]) cursor[segments[i]] = {};
        cursor = cursor[segments[i]];
      }
      cursor[segments.at(-1)] = value;
      return next;
    });
  };

  const onNumber =
    (path, { min, max, step = 1 } = {}) =>
    (event) => {
      const raw = event.target.value;
      if (raw === "") return;
      let value = Number(raw);
      if (!Number.isFinite(value)) return;
      if (min != null) value = Math.max(min, value);
      if (max != null) value = Math.min(max, value);
      value = Math.round(value / step) * step;

      setForm((prev) => {
        const next = structuredClone(prev);
        const segments = path.split(".");
        let cursor = next;
        for (let i = 0; i < segments.length - 1; i += 1) {
          if (!cursor[segments[i]]) cursor[segments[i]] = {};
          cursor = cursor[segments[i]];
        }
        cursor[segments.at(-1)] = value;
        return next;
      });
    };

  const handleSave = async () => {
    try {
      await persistSettings(form);
    } catch (error) {
      console.error(error);
      toast.error("Luu that bai");
    }
  };

  const handleOpenRecordingDriveAuth = async () => {
    try {
      if (!form?.recordingDrive?.folderId?.trim()) {
        toast.error("Hay nhap Folder ID roi luu/ket noi lai.");
        return;
      }
      await persistSettings(form, { showSuccessToast: false });
      const result = await getRecordingDriveOAuthInit().unwrap();
      if (!result?.authUrl) {
        throw new Error("Khong tao duoc duong dan ket noi Google Drive");
      }
      const popup = window.open(
        result.authUrl,
        "recording-drive-auth",
        "popup=yes,width=720,height=800"
      );
      recordingDrivePopupRef.current = popup || null;
      if (!popup) {
        toast.error("Trinh duyet da chan popup. Hay cho phep popup roi thu lai.");
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Khong mo duoc ket noi Google Drive");
    }
  };

  const handleDisconnectRecordingDrive = async () => {
    try {
      await disconnectRecordingDrive().unwrap();
      toast.success("Da ngat ket noi Google Drive cho recording.");
      refetchRecordingDriveStatus();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Khong the ngat ket noi Google Drive");
    }
  };

  const setRecordingDriveMode = (mode) => {
    setForm((prev) => ({
      ...prev,
      recordingDrive: {
        ...(prev.recordingDrive || {}),
        mode: getInitialRecordingDriveMode(mode),
      },
    }));
  };

  const recordingDriveAlertSeverityValue = (() => {
    if (recordingDriveStatus?.ready) return "success";
    if (recordingDriveStatus?.configured || recordingDriveStatus?.connected) return "warning";
    return "info";
  })();

  if (isError) {
    return (
      <Box p={2}>
        <Alert severity="error">Khong tai duoc cai dat. Vui long thu lai.</Alert>
      </Box>
    );
  }

  if (isLoading || !form) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box p={2} sx={{ position: "relative" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Skeleton variant="text" width={220} height={36} />
            <Skeleton variant="rounded" width={160} height={36} />
          </Stack>

          <Stack spacing={2}>
            <SectionSkeleton lines={3} />
            <SectionSkeleton lines={2} />
            <SectionSkeleton lines={2} />
            <SectionSkeleton lines={1} />
            <SectionSkeleton lines={2} />
            <SectionSkeleton lines={4} />
            <SectionSkeleton lines={2} />
          </Stack>

          <Box sx={{ position: "absolute", top: 12, right: 12 }}>
            <Tooltip title="Dang tai cai dat">
              <CircularProgress size={20} />
            </Tooltip>
          </Box>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={800}>
            Cai dat he thong
          </Typography>
          <Box ref={topSaveRef}>
            <Button variant="contained" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Dang luu..." : "Luu thay doi"}
            </Button>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Section
            title="KYC"
            desc="Bat/tat KYC, tu dong duyet va dieu chinh nguong khop khuon mat (0-1)."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bat KYC</Typography>
              <Switch checked={!!form.kyc?.enabled} onChange={onToggle("kyc.enabled")} />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bat, ho so hop le se duoc duyet ngay ma khong can mod xet duyet.">
                <Typography>Tu dong duyet KYC</Typography>
              </Tooltip>
              <Switch checked={!!form.kyc?.autoApprove} onChange={onToggle("kyc.autoApprove")} />
            </Stack>

            <TextField
              label="Face match threshold"
              type="number"
              inputProps={{ step: 0.01, min: 0, max: 1 }}
              value={form.kyc?.faceMatchThreshold ?? 0.78}
              onChange={onNumber("kyc.faceMatchThreshold", {
                min: 0,
                max: 1,
                step: 0.01,
              })}
              helperText="0.00-1.00 (de xuat 0.75-0.85)"
              fullWidth
            />
          </Section>

          <Section title="He thong & bao tri" desc="Dong toan bo he thong khi bao tri.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bao tri (Maintenance mode)</Typography>
              <Switch
                checked={!!form.maintenance?.enabled}
                onChange={onToggle("maintenance.enabled")}
              />
            </Stack>
            <TextField
              label="Thong bao bao tri"
              value={form.maintenance?.message ?? ""}
              onChange={onChange("maintenance.message")}
              placeholder="Vi du: He thong bao tri luc 23:00-01:00."
              fullWidth
            />
          </Section>

          <Section
            title="OTA"
            desc="Bat de chan app va bat buoc nguoi dung cap nhat truoc khi vao."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bat, backend se chan app cu va yeu cau cap nhat.">
                <Typography>Bat buoc cap nhat OTA</Typography>
              </Tooltip>
              <Switch
                checked={!!form.ota?.forceUpdateEnabled}
                onChange={onToggle("ota.forceUpdateEnabled")}
              />
            </Stack>
          </Section>

          <Section title="Dang ky tai khoan" desc="Mo/dong dang ky nguoi dung moi.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Cho phep dang ky moi</Typography>
              <Switch
                checked={!!form.registration?.open}
                onChange={onToggle("registration.open")}
              />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bat, cac truong SDT, gioi tinh, tinh/thanh va ngay sinh se bat buoc khi dang ky.">
                <Typography>Bat buoc thong tin ho so mo rong</Typography>
              </Tooltip>
              <Switch
                checked={!!form.registration?.requireOptionalProfileFields}
                onChange={onToggle("registration.requireOptionalProfileFields")}
              />
            </Stack>
          </Section>

          <Section title="Bao mat">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bat buoc 2FA cho Admin</Typography>
              <Switch
                checked={!!form.security?.enforce2FAForAdmins}
                onChange={onToggle("security.enforce2FAForAdmins")}
              />
            </Stack>
            <TextField
              label="Phien dang nhap (gio)"
              type="number"
              inputProps={{ min: 1, max: 720 }}
              value={form.security?.sessionTTLHours ?? 72}
              onChange={onNumber("security.sessionTTLHours", { min: 1, max: 720 })}
              fullWidth
            />
          </Section>

          <Section title="Upload">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bat, he thong se tu dong chen logo len anh dai dien nguoi dung neu server da cau hinh logo.">
                <Typography>Chen logo vao anh dai dien</Typography>
              </Tooltip>
              <Switch
                checked={!!form.uploads?.avatarLogoEnabled}
                onChange={onToggle("uploads.avatarLogoEnabled")}
              />
            </Stack>

            <TextField
              label="Gioi han anh dai dien (MB)"
              type="number"
              inputProps={{ min: 1, max: 50 }}
              value={form.uploads?.maxAvatarSizeMB ?? 5}
              onChange={onNumber("uploads.maxAvatarSizeMB", { min: 1, max: 50 })}
              fullWidth
            />
          </Section>

          <Section
            title="Drive export cho recording"
            desc="Chon cach dua file record cuoi cung len Google Drive. Shared Drive dung service account. My Drive ca nhan dung OAuth cua user."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bat export len Drive</Typography>
              <Switch
                checked={!!form.recordingDrive?.enabled}
                onChange={onToggle("recordingDrive.enabled")}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Button
                variant={
                  getInitialRecordingDriveMode(form.recordingDrive?.mode) === "serviceAccount"
                    ? "contained"
                    : "outlined"
                }
                onClick={() => setRecordingDriveMode("serviceAccount")}
                fullWidth
              >
                Shared Drive (Service Account)
              </Button>
              <Button
                variant={form.recordingDrive?.mode === "oauthUser" ? "contained" : "outlined"}
                onClick={() => setRecordingDriveMode("oauthUser")}
                fullWidth
              >
                My Drive ca nhan (OAuth)
              </Button>
            </Stack>

            <Alert severity={recordingDriveAlertSeverityValue}>
              {isRecordingDriveStatusLoading
                ? "Dang kiem tra ket noi Google Drive..."
                : recordingDriveStatus?.message || "Chua co trang thai Google Drive."}
            </Alert>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Folder ID"
                value={form.recordingDrive?.folderId ?? ""}
                onChange={onChange("recordingDrive.folderId")}
                placeholder="Folder dich de luu video recording"
                fullWidth
              />
              <TextField
                label="Shared Drive ID"
                value={form.recordingDrive?.sharedDriveId ?? ""}
                onChange={onChange("recordingDrive.sharedDriveId")}
                placeholder="Chi dung cho mode service account"
                disabled={form.recordingDrive?.mode === "oauthUser"}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Mode dang chay"
                value={
                  recordingDriveStatus?.mode === "oauthUser"
                    ? "My Drive ca nhan (OAuth)"
                    : "Shared Drive (Service Account)"
                }
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <TextField
                label="Tai khoan da ket noi"
                value={recordingDriveStatus?.accountEmail || "-"}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={handleOpenRecordingDriveAuth}
                disabled={form.recordingDrive?.mode !== "oauthUser" || isRecordingDriveConnecting}
              >
                {isRecordingDriveConnecting ? "Dang mo ket noi..." : "Ket noi Google Drive"}
              </Button>
              <Button
                variant="outlined"
                onClick={() => refetchRecordingDriveStatus()}
                disabled={isRecordingDriveStatusLoading}
              >
                {isRecordingDriveStatusLoading ? "Dang kiem tra..." : "Kiem tra ket noi"}
              </Button>
              <Button
                color="error"
                variant="outlined"
                onClick={handleDisconnectRecordingDrive}
                disabled={
                  form.recordingDrive?.mode !== "oauthUser" ||
                  !recordingDriveStatus?.connected ||
                  isRecordingDriveDisconnecting
                }
              >
                {isRecordingDriveDisconnecting ? "Dang ngat..." : "Ngat ket noi"}
              </Button>
            </Stack>
          </Section>

          <Section title="Su kien" desc="Cai dat thong bao lien quan den he thong.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bat thong bao day (Push) toan he thong</Typography>
              <Switch
                checked={!!form.notifications?.systemPushEnabled}
                onChange={onToggle("notifications.systemPushEnabled")}
              />
            </Stack>
          </Section>

          <Section
            title="Thong bao (Telegram)"
            desc="Token de o ENV. Tai day chi bat/tat va dat Chat ID."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bat Telegram</Typography>
              <Switch
                checked={!!form.notifications?.telegramEnabled}
                onChange={onToggle("notifications.telegramEnabled")}
              />
            </Stack>
            <TextField
              label="Complaint Chat ID"
              value={form.notifications?.telegramComplaintChatId ?? ""}
              onChange={onChange("notifications.telegramComplaintChatId")}
              placeholder="-1001234567890"
              fullWidth
            />
          </Section>

          <Section
            title="Link huong dan"
            desc="Duong dan toi trang huong dan su dung, FAQ hoac docs."
          >
            <TextField
              label="URL huong dan"
              value={form.links?.guideUrl ?? ""}
              onChange={onChange("links.guideUrl")}
              placeholder="https://docs.pickletour.vn/huong-dan"
              fullWidth
            />
          </Section>
        </Stack>
      </Box>

      <Fab
        color="primary"
        aria-label="save"
        variant="extended"
        onClick={handleSave}
        disabled={isSaving}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
          boxShadow: 3,
          px: 3,
          transition: "opacity 0.3s, transform 0.3s",
          opacity: showFab ? 1 : 0,
          transform: showFab ? "translateY(0)" : "translateY(20px)",
          pointerEvents: showFab ? "auto" : "none",
        }}
      >
        {isSaving ? (
          <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
        ) : (
          <SaveIcon sx={{ mr: 1 }} />
        )}
        {isSaving ? "Dang luu..." : "Luu thay doi"}
      </Fab>
    </DashboardLayout>
  );
}
