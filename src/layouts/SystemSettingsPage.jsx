import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Fab,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useGetLiveRecordingAiCommentaryMonitorQuery } from "slices/liveApiSlice";
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

const hydrateFormState = (source) => ({
  ...structuredClone(source || {}),
  recordingDrive: {
    enabled: source?.recordingDrive?.enabled ?? true,
    mode: getInitialRecordingDriveMode(source?.recordingDrive?.mode),
    folderId: source?.recordingDrive?.folderId ?? "",
    sharedDriveId: source?.recordingDrive?.sharedDriveId ?? "",
  },
  liveRecording: {
    autoExportNoSegmentMinutes: source?.liveRecording?.autoExportNoSegmentMinutes ?? 15,
    aiCommentary: {
      enabled: source?.liveRecording?.aiCommentary?.enabled ?? false,
      autoGenerateAfterDriveUpload:
        source?.liveRecording?.aiCommentary?.autoGenerateAfterDriveUpload ?? true,
      defaultLanguage: source?.liveRecording?.aiCommentary?.defaultLanguage ?? "vi",
      defaultVoicePreset: source?.liveRecording?.aiCommentary?.defaultVoicePreset ?? "vi_male_pro",
      scriptBaseUrl: source?.liveRecording?.aiCommentary?.scriptBaseUrl ?? "",
      scriptModel: source?.liveRecording?.aiCommentary?.scriptModel ?? "",
      ttsBaseUrl: source?.liveRecording?.aiCommentary?.ttsBaseUrl ?? "",
      ttsModel: source?.liveRecording?.aiCommentary?.ttsModel ?? "",
      defaultTonePreset: source?.liveRecording?.aiCommentary?.defaultTonePreset ?? "professional",
      keepOriginalAudioBed: source?.liveRecording?.aiCommentary?.keepOriginalAudioBed ?? true,
      audioBedLevelDb: source?.liveRecording?.aiCommentary?.audioBedLevelDb ?? -18,
      duckAmountDb: source?.liveRecording?.aiCommentary?.duckAmountDb ?? -12,
    },
  },
});

const AI_COMMENTARY_LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const AI_COMMENTARY_VOICE_OPTIONS = [
  { value: "vi_male_pro", label: "Nam VI Pro" },
  { value: "vi_female_pro", label: "Nữ VI Pro" },
  { value: "en_male_pro", label: "Male EN Pro" },
  { value: "en_female_pro", label: "Female EN Pro" },
];

const AI_COMMENTARY_TONE_OPTIONS = [
  { value: "professional", label: "Chuyên nghiệp" },
  { value: "energetic", label: "Nhiệt huyết" },
  { value: "dramatic", label: "Kịch tính" },
];

const normalizeAiGatewayBaseUrl = (value = "") => {
  let next = String(value || "").trim();
  if (!next) return "";
  next = next.replace(/\/+$/, "");
  next = next.replace(/\/responses$/i, "");
  next = next.replace(/\/models$/i, "");
  next = next.replace(/\/audio\/speech$/i, "");
  return next;
};

const buildAiGatewayModelsUrl = (value = "") => {
  const baseUrl = normalizeAiGatewayBaseUrl(value);
  return baseUrl ? `${baseUrl}/models` : "";
};

const buildAiGatewayResponsesUrl = (value = "") => {
  const baseUrl = normalizeAiGatewayBaseUrl(value);
  return baseUrl ? `${baseUrl}/responses` : "";
};

const buildAiGatewaySpeechUrl = (value = "") => {
  const baseUrl = normalizeAiGatewayBaseUrl(value);
  return baseUrl ? `${baseUrl}/audio/speech` : "";
};

export default function SystemSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSystemSettingsQuery();
  const {
    data: commentaryMonitor,
    isFetching: isCommentaryMonitorFetching,
    refetch: refetchCommentaryMonitor,
  } = useGetLiveRecordingAiCommentaryMonitorQuery();
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
  const commentaryGateway = commentaryMonitor?.gatewayHealth || {};
  const commentaryScriptGateway = commentaryGateway?.script || {};
  const commentaryTtsGateway = commentaryGateway?.tts || {};
  const commentaryScriptModels = Array.isArray(commentaryScriptGateway?.availableModels)
    ? commentaryScriptGateway.availableModels
    : [];
  const commentaryTtsModels = Array.isArray(commentaryTtsGateway?.availableModels)
    ? commentaryTtsGateway.availableModels
    : [];

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
    liveRecording: {
      autoExportNoSegmentMinutes: source.liveRecording?.autoExportNoSegmentMinutes ?? 15,
      aiCommentary: {
        enabled: !!source.liveRecording?.aiCommentary?.enabled,
        autoGenerateAfterDriveUpload:
          source.liveRecording?.aiCommentary?.autoGenerateAfterDriveUpload !== false,
        defaultLanguage: source.liveRecording?.aiCommentary?.defaultLanguage ?? "vi",
        defaultVoicePreset: source.liveRecording?.aiCommentary?.defaultVoicePreset ?? "vi_male_pro",
        scriptBaseUrl: source.liveRecording?.aiCommentary?.scriptBaseUrl ?? "",
        scriptModel: source.liveRecording?.aiCommentary?.scriptModel ?? "",
        ttsBaseUrl: source.liveRecording?.aiCommentary?.ttsBaseUrl ?? "",
        ttsModel: source.liveRecording?.aiCommentary?.ttsModel ?? "",
        defaultTonePreset: source.liveRecording?.aiCommentary?.defaultTonePreset ?? "professional",
        keepOriginalAudioBed: source.liveRecording?.aiCommentary?.keepOriginalAudioBed !== false,
        audioBedLevelDb: source.liveRecording?.aiCommentary?.audioBedLevelDb ?? -18,
        duckAmountDb: source.liveRecording?.aiCommentary?.duckAmountDb ?? -12,
      },
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm(hydrateFormState(data));
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
        toast.success("Đã kết nối Google Drive cho bản ghi.");
      } else {
        toast.error(event.data?.message || "Kết nối Google Drive thất bại.");
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
    const updated = await updateSettings(payload).unwrap();
    setForm(hydrateFormState(updated));
    if (showSuccessToast) {
      toast.success("Đã lưu cài đặt hệ thống");
    }
    await Promise.all([refetch(), refetchRecordingDriveStatus(), refetchCommentaryMonitor()]);
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
      toast.error("Lưu thất bại");
    }
  };

  const handleOpenRecordingDriveAuth = async () => {
    try {
      if (!form?.recordingDrive?.folderId?.trim()) {
        toast.error("Hãy nhập Folder ID rồi lưu/kết nối lại.");
        return;
      }
      await persistSettings(form, { showSuccessToast: false });
      const result = await getRecordingDriveOAuthInit().unwrap();
      if (!result?.authUrl) {
        throw new Error("Không tạo được đường dẫn kết nối Google Drive");
      }
      const popup = window.open(
        result.authUrl,
        "recording-drive-auth",
        "popup=yes,width=720,height=800"
      );
      recordingDrivePopupRef.current = popup || null;
      if (!popup) {
        toast.error("Trình duyệt đã chặn popup. Hãy cho phép popup rồi thử lại.");
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Không mở được kết nối Google Drive");
    }
  };

  const handleDisconnectRecordingDrive = async () => {
    try {
      await disconnectRecordingDrive().unwrap();
      toast.success("Đã ngắt kết nối Google Drive cho bản ghi.");
      refetchRecordingDriveStatus();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Không thể ngắt kết nối Google Drive");
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
        <Alert severity="error">Không tải được cài đặt. Vui lòng thử lại.</Alert>
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
            <Tooltip title="Đang tải cài đặt">
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
            Cài đặt hệ thống
          </Typography>
          <Box ref={topSaveRef}>
            <Button variant="contained" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Section
            title="KYC"
            desc="Bật/tắt KYC, tự động duyệt và điều chỉnh ngưỡng khớp khuôn mặt (0-1)."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bật KYC</Typography>
              <Switch checked={!!form.kyc?.enabled} onChange={onToggle("kyc.enabled")} />
            </Stack>

            <Alert severity={commentaryGateway?.overallStatus === "online" ? "success" : "info"}>
              {isCommentaryMonitorFetching
                ? "Dang tai gateway/model list..."
                : `Script: ${commentaryScriptGateway?.message || "-"} | TTS: ${
                    commentaryTtsGateway?.message || "-"
                  }`}
            </Alert>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Script base URL"
                value={form.liveRecording?.aiCommentary?.scriptBaseUrl ?? ""}
                onChange={onChange("liveRecording.aiCommentary.scriptBaseUrl")}
                placeholder="http://localhost:8080/v1"
                helperText="Save URL nay roi model list se duoc load tu /models."
                fullWidth
              />
              <TextField
                label="Script responses URL"
                value={buildAiGatewayResponsesUrl(form.liveRecording?.aiCommentary?.scriptBaseUrl)}
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <TextField
                label="Script models URL"
                value={buildAiGatewayModelsUrl(form.liveRecording?.aiCommentary?.scriptBaseUrl)}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Script model"
                value={form.liveRecording?.aiCommentary?.scriptModel ?? ""}
                onChange={onChange("liveRecording.aiCommentary.scriptModel")}
                helperText={`Effective: ${commentaryScriptGateway?.effectiveModel || "-"}`}
                fullWidth
              >
                <MenuItem value="">Auto (model dau tien tu /models)</MenuItem>
                {commentaryScriptModels.map((modelId) => (
                  <MenuItem key={modelId} value={modelId}>
                    {modelId}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="TTS base URL"
                value={form.liveRecording?.aiCommentary?.ttsBaseUrl ?? ""}
                onChange={onChange("liveRecording.aiCommentary.ttsBaseUrl")}
                placeholder="http://localhost:5000/api/ai-tts/v1"
                helperText="Neu dung adapter free local, tro vao /api/ai-tts/v1. He thong tu suy ra /audio/speech va /models."
                fullWidth
              />
              <TextField
                label="TTS speech URL"
                value={buildAiGatewaySpeechUrl(form.liveRecording?.aiCommentary?.ttsBaseUrl)}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="TTS models URL"
                value={buildAiGatewayModelsUrl(form.liveRecording?.aiCommentary?.ttsBaseUrl)}
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <TextField
                select
                label="TTS model"
                value={form.liveRecording?.aiCommentary?.ttsModel ?? ""}
                onChange={onChange("liveRecording.aiCommentary.ttsModel")}
                helperText={`Effective: ${commentaryTtsGateway?.effectiveModel || "-"}`}
                fullWidth
              >
                <MenuItem value="">Auto (model dau tien tu /models)</MenuItem>
                {commentaryTtsModels.map((modelId) => (
                  <MenuItem key={modelId} value={modelId}>
                    {modelId}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bật, hồ sơ hợp lệ sẽ được duyệt ngay mà không cần duyệt thủ công.">
                <Typography>Tự động duyệt KYC</Typography>
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
              helperText="0.00-1.00 (đề xuất 0.75-0.85)"
              fullWidth
            />
          </Section>

          <Section title="Hệ thống & bảo trì" desc="Đóng toàn bộ hệ thống khi bảo trì.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bảo trì (Maintenance mode)</Typography>
              <Switch
                checked={!!form.maintenance?.enabled}
                onChange={onToggle("maintenance.enabled")}
              />
            </Stack>
            <TextField
              label="Thông báo bảo trì"
              value={form.maintenance?.message ?? ""}
              onChange={onChange("maintenance.message")}
              placeholder="Ví dụ: Hệ thống bảo trì lúc 23:00-01:00."
              fullWidth
            />
          </Section>

          <Section
            title="OTA"
            desc="Bật để chặn app và bắt buộc người dùng cập nhật trước khi vào."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bật, backend sẽ chặn app cũ và yêu cầu cập nhật.">
                <Typography>Bắt buộc cập nhật OTA</Typography>
              </Tooltip>
              <Switch
                checked={!!form.ota?.forceUpdateEnabled}
                onChange={onToggle("ota.forceUpdateEnabled")}
              />
            </Stack>
          </Section>

          <Section title="Đăng ký tài khoản" desc="Mở/đóng đăng ký người dùng mới.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Cho phép đăng ký mới</Typography>
              <Switch
                checked={!!form.registration?.open}
                onChange={onToggle("registration.open")}
              />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bật, SĐT, giới tính, tỉnh/thành và ngày sinh sẽ bắt buộc khi đăng ký.">
                <Typography>Bắt buộc thông tin hồ sơ mở rộng</Typography>
              </Tooltip>
              <Switch
                checked={!!form.registration?.requireOptionalProfileFields}
                onChange={onToggle("registration.requireOptionalProfileFields")}
              />
            </Stack>
          </Section>

          <Section title="Bảo mật">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bắt buộc 2FA cho Admin</Typography>
              <Switch
                checked={!!form.security?.enforce2FAForAdmins}
                onChange={onToggle("security.enforce2FAForAdmins")}
              />
            </Stack>
            <TextField
              label="Phiên đăng nhập (giờ)"
              type="number"
              inputProps={{ min: 1, max: 720 }}
              value={form.security?.sessionTTLHours ?? 72}
              onChange={onNumber("security.sessionTTLHours", { min: 1, max: 720 })}
              fullWidth
            />
          </Section>

          <Section title="Upload">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bật, hệ thống sẽ tự động chèn logo lên ảnh đại diện người dùng nếu server đã cấu hình logo.">
                <Typography>Chèn logo vào ảnh đại diện</Typography>
              </Tooltip>
              <Switch
                checked={!!form.uploads?.avatarLogoEnabled}
                onChange={onToggle("uploads.avatarLogoEnabled")}
              />
            </Stack>

            <TextField
              label="Giới hạn ảnh đại diện (MB)"
              type="number"
              inputProps={{ min: 1, max: 50 }}
              value={form.uploads?.maxAvatarSizeMB ?? 5}
              onChange={onNumber("uploads.maxAvatarSizeMB", { min: 1, max: 50 })}
              fullWidth
            />
          </Section>

          <Section
            title="Drive export bản ghi"
            desc="Chọn cách đưa file bản ghi cuối cùng lên Google Drive. Shared Drive dùng service account. My Drive cá nhân dùng OAuth của user."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bật export lên Drive</Typography>
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
                My Drive cá nhân (OAuth)
              </Button>
            </Stack>

            <Alert severity={recordingDriveAlertSeverityValue}>
              {isRecordingDriveStatusLoading
                ? "Đang kiểm tra kết nối Google Drive..."
                : recordingDriveStatus?.message || "Chưa có trạng thái Google Drive."}
            </Alert>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Folder ID"
                value={form.recordingDrive?.folderId ?? ""}
                onChange={onChange("recordingDrive.folderId")}
                placeholder="Folder đích tạo bản ghi"
                fullWidth
              />
              <TextField
                label="Shared Drive ID"
                value={form.recordingDrive?.sharedDriveId ?? ""}
                onChange={onChange("recordingDrive.sharedDriveId")}
                placeholder="Chỉ dùng cho mode service account"
                disabled={form.recordingDrive?.mode === "oauthUser"}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Mode đang chạy"
                value={
                  recordingDriveStatus?.mode === "oauthUser"
                    ? "My Drive cá nhân (OAuth)"
                    : "Shared Drive (Service Account)"
                }
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <TextField
                label="Tài khoản đã kết nối"
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
                {isRecordingDriveConnecting ? "Đang mở kết nối..." : "Kết nối Google Drive"}
              </Button>
              <Button
                variant="outlined"
                onClick={() => refetchRecordingDriveStatus()}
                disabled={isRecordingDriveStatusLoading}
              >
                {isRecordingDriveStatusLoading ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
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
                {isRecordingDriveDisconnecting ? "Đang ngắt..." : "Ngắt kết nối"}
              </Button>
            </Stack>
          </Section>

          <Section title="Sự kiện" desc="Cài đặt thông báo liên quan đến hệ thống.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bật thông báo đẩy (Push) toàn hệ thống</Typography>
              <Switch
                checked={!!form.notifications?.systemPushEnabled}
                onChange={onToggle("notifications.systemPushEnabled")}
              />
            </Stack>
          </Section>

          <Section
            title="Thông báo (Telegram)"
            desc="Token đã để ở ENV. Tại đây chỉ bật/tắt và đặt Chat ID."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bật Telegram</Typography>
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
            title="Live recording"
            desc="Tự động chốt bản ghi và chuyển sang export nếu thiết bị đang live bị sập nguồn hoặc ngừng upload quá lâu."
          >
            <TextField
              label="Timeout không có segment mới (phút)"
              type="number"
              inputProps={{ min: 1, max: 1440 }}
              value={form.liveRecording?.autoExportNoSegmentMinutes ?? 15}
              onChange={onNumber("liveRecording.autoExportNoSegmentMinutes", {
                min: 1,
                max: 1440,
              })}
              helperText="Mặc định 15 phút. Khi quá ngưỡng và đã có ít nhất một segment upload thành công, backend sẽ tự chuyển recording sang export."
              fullWidth
            />
          </Section>

          <Section
            title="Link hướng dẫn"
            desc="Đường dẫn tới trang hướng dẫn sử dụng, FAQ hoặc docs."
          >
            <TextField
              label="URL hướng dẫn"
              value={form.links?.guideUrl ?? ""}
              onChange={onChange("links.guideUrl")}
              placeholder="https://docs.pickletour.vn/huong-dan"
              fullWidth
            />
          </Section>

          <Section
            title="AI bình luận video trận"
            desc="Công tắc global cho BLV AI sau khi video trận đã export và upload lên Drive."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={700}>Bật AI lồng tiếng BLV</Typography>
                <Typography variant="body2" color="text.secondary">
                  Khi tắt, backend sẽ không auto queue và màn monitor cũng khóa thao tác render tay.
                </Typography>
              </Box>
              <Switch
                checked={!!form.liveRecording?.aiCommentary?.enabled}
                onChange={onToggle("liveRecording.aiCommentary.enabled")}
              />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={700}>Tự động chạy sau khi video lên Drive</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chỉ queue khi recording đã ready, trận đã kết thúc và global BLV AI đang bật.
                </Typography>
              </Box>
              <Switch
                checked={!!form.liveRecording?.aiCommentary?.autoGenerateAfterDriveUpload}
                onChange={onToggle("liveRecording.aiCommentary.autoGenerateAfterDriveUpload")}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Ngôn ngữ mặc định"
                value={form.liveRecording?.aiCommentary?.defaultLanguage ?? "vi"}
                onChange={onChange("liveRecording.aiCommentary.defaultLanguage")}
                fullWidth
              >
                {AI_COMMENTARY_LANGUAGE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Giọng BLV mặc định"
                value={form.liveRecording?.aiCommentary?.defaultVoicePreset ?? "vi_male_pro"}
                onChange={onChange("liveRecording.aiCommentary.defaultVoicePreset")}
                fullWidth
              >
                {AI_COMMENTARY_VOICE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Tông giọng mặc định"
                value={form.liveRecording?.aiCommentary?.defaultTonePreset ?? "professional"}
                onChange={onChange("liveRecording.aiCommentary.defaultTonePreset")}
                fullWidth
              >
                {AI_COMMENTARY_TONE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography fontWeight={700}>Giữ tiếng sân làm nền</Typography>
                <Typography variant="body2" color="text.secondary">
                  Giữ ambience/cổ động ở nền và tự duck xuống khi BLV AI bắt đầu nói.
                </Typography>
              </Box>
              <Switch
                checked={!!form.liveRecording?.aiCommentary?.keepOriginalAudioBed}
                onChange={onToggle("liveRecording.aiCommentary.keepOriginalAudioBed")}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Mức nền gốc (dB)"
                type="number"
                inputProps={{ min: -40, max: 0 }}
                value={form.liveRecording?.aiCommentary?.audioBedLevelDb ?? -18}
                onChange={onNumber("liveRecording.aiCommentary.audioBedLevelDb", {
                  min: -40,
                  max: 0,
                })}
                helperText="Âm lượng nền sau khi giảm, mặc định -18 dB."
                fullWidth
              />
              <TextField
                label="Mức duck khi BLV nói (dB)"
                type="number"
                inputProps={{ min: -30, max: 0 }}
                value={form.liveRecording?.aiCommentary?.duckAmountDb ?? -12}
                onChange={onNumber("liveRecording.aiCommentary.duckAmountDb", {
                  min: -30,
                  max: 0,
                })}
                helperText="Mức nén/duck thêm cho âm gốc khi có narration."
                fullWidth
              />
            </Stack>
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
        {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
      </Fab>
    </DashboardLayout>
  );
}
