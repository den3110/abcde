// src/pages/admin/SystemSettingsPage.jsx
import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Stack,
  Paper,
  Typography,
  Switch,
  TextField,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Tooltip,
  Skeleton,
  Fab,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import {
  useGetSystemSettingsQuery,
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

/* ========= Skeleton components ========= */
function SectionSkeleton({ lines = 3 }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Skeleton variant="text" width={180} height={28} />
        <Skeleton variant="text" width="60%" height={18} />
        <Divider />
        <Stack spacing={1.25} sx={{ pt: 1 }}>
          {Array.from({ length: lines }).map((_, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 16 }}>
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

export default function SystemSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSystemSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateSystemSettingsMutation();

  const [form, setForm] = useState(null);
  const [showFab, setShowFab] = useState(false);
  const topSaveRef = useRef(null);

  useEffect(() => {
    if (data) setForm(structuredClone(data));
  }, [data]);

  useEffect(() => {
    if (isLoading || !topSaveRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show FAB when top button is not accessible in the viewport
        setShowFab(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(topSaveRef.current);
    return () => observer.disconnect();
  }, [isLoading, form]);

  const onToggle = (path) => (e) => {
    const val = e.target.checked;
    setForm((prev) => {
      const next = structuredClone(prev);
      const seg = path.split(".");
      let obj = next;
      for (let i = 0; i < seg.length - 1; i++) {
        if (!obj[seg[i]]) obj[seg[i]] = {};
        obj = obj[seg[i]];
      }
      obj[seg.at(-1)] = val;
      return next;
    });
  };

  const onChange = (path) => (e) => {
    const val = e.target.value;
    setForm((prev) => {
      const next = structuredClone(prev);
      const seg = path.split(".");
      let obj = next;
      for (let i = 0; i < seg.length - 1; i++) {
        if (!obj[seg[i]]) obj[seg[i]] = {};
        obj = obj[seg[i]];
      }
      obj[seg.at(-1)] = val;
      return next;
    });
  };

  const onNumber =
    (path, { min, max, step = 1 } = {}) =>
    (e) => {
      const v = e.target.value;
      if (v === "") return; // allow empty while typing
      let num = Number(v);
      if (!Number.isFinite(num)) return;
      if (min != null) num = Math.max(min, num);
      if (max != null) num = Math.min(max, num);
      num = Math.round(num / step) * step;

      setForm((prev) => {
        const next = structuredClone(prev);
        const seg = path.split(".");
        let obj = next;
        for (let i = 0; i < seg.length - 1; i++) {
          if (!obj[seg[i]]) obj[seg[i]] = {};
          obj = obj[seg[i]];
        }
        obj[seg.at(-1)] = num;
        return next;
      });
    };

  const handleSave = async () => {
    try {
      const payload = {
        maintenance: {
          enabled: !!form.maintenance?.enabled,
          message: form.maintenance?.message ?? "",
        },
        registration: {
          open: !!form.registration?.open,
          // 👇 điều khiển requireOptional ở app
          requireOptionalProfileFields: !!form.registration?.requireOptionalProfileFields,
        },
        kyc: {
          enabled: !!form.kyc?.enabled,
          autoApprove: !!form.kyc?.autoApprove,
          faceMatchThreshold: form.kyc?.faceMatchThreshold ?? 0.78,
        },
        security: {
          enforce2FAForAdmins: !!form.security?.enforce2FAForAdmins,
          sessionTTLHours: form.security?.sessionTTLHours ?? 72,
        },
        uploads: {
          maxAvatarSizeMB: form.uploads?.maxAvatarSizeMB ?? 5,
          avatarLogoEnabled: !!form.uploads?.avatarLogoEnabled,
        },
        notifications: {
          telegramEnabled: !!form.notifications?.telegramEnabled,
          telegramComplaintChatId: form.notifications?.telegramComplaintChatId ?? "",
          systemPushEnabled: !!form.notifications?.systemPushEnabled,
        },
        links: {
          guideUrl: form.links?.guideUrl ?? "",
        },

        // 👇 NEW: OTA - bật thì app bị chặn (force update)
        ota: {
          forceUpdateEnabled: !!form.ota?.forceUpdateEnabled,
        },
      };

      await updateSettings(payload).unwrap();
      toast.success("Đã lưu cài đặt hệ thống");
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Lưu thất bại");
    }
  };

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
          {/* Header skeleton */}
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
            <SectionSkeleton lines={1} />
            <SectionSkeleton lines={1} />
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
            desc="Bật tắt KYC, tự động duyệt KYC, và ngưỡng khớp khuôn mặt (0–1)."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Bật KYC</Typography>
              <Switch checked={!!form.kyc?.enabled} onChange={onToggle("kyc.enabled")} />
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bật, hồ sơ hợp lệ sẽ được duyệt ngay mà không cần mod xét duyệt. Cân nhắc rủi ro.">
                <Typography>Tự động duyệt KYC</Typography>
              </Tooltip>
              <Switch checked={!!form.kyc?.autoApprove} onChange={onToggle("kyc.autoApprove")} />
            </Stack>

            <Stack direction="row" spacing={2}>
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
                helperText="0.00–1.00 (đề xuất: 0.75–0.85)"
                fullWidth
              />
            </Stack>
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
              placeholder="Ví dụ: Hệ thống bảo trì lúc 23:00–01:00."
              fullWidth
            />
          </Section>

          {/* ✅ NEW: OTA */}
          <Section
            title="OTA"
            desc="Bật để chặn app và bắt buộc người dùng cập nhật OTA trước khi vào."
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tooltip title="Khi bật: backend trả allowed=false ⇒ app sẽ bị chặn và yêu cầu cập nhật.">
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
              <Tooltip title="Khi bật, các trường SĐT, giới tính, tỉnh/thành, ngày sinh sẽ bắt buộc khi đăng ký. Khi tắt, các trường này trở thành tùy chọn.">
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
              <Tooltip title="Khi bật, hệ thống sẽ tự động chèn logo lên ảnh đại diện người dùng (nếu logo được cấu hình trên server).">
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
            desc="Token để ở ENV; tại đây chỉ bật/tắt và đặt Chat ID."
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
            title="Link hướng dẫn"
            desc="Đường dẫn tới trang hướng dẫn sử dụng / FAQ / docs."
          >
            <TextField
              label="URL hướng dẫn "
              value={form.links?.guideUrl ?? ""}
              onChange={onChange("links.guideUrl")}
              placeholder="https://docs.pickletour.vn/huong-dan"
              fullWidth
            />
          </Section>
        </Stack>
      </Box>

      {/* Floating Action Button (FAB) for Save */}
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
