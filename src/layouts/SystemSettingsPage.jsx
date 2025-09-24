// src/pages/admin/SystemSettingsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  Skeleton, // ✅ thêm Skeleton
} from "@mui/material";
import {
  useGetSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
} from "slices/settingsApiSlice";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";

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

// ⬇️ giữ prop-types như cũ
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

  useEffect(() => {
    if (data) setForm(structuredClone(data));
  }, [data]);

  const onToggle = (path) => (e) => {
    const val = e.target.checked;
    setForm((prev) => {
      const next = structuredClone(prev);
      const seg = path.split(".");
      let obj = next;
      for (let i = 0; i < seg.length - 1; i++) obj = obj[seg[i]];
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
      for (let i = 0; i < seg.length - 1; i++) obj = obj[seg[i]];
      obj[seg.at(-1)] = val;
      return next;
    });
  };

  const onNumber =
    (path, { min, max, step = 1 } = {}) =>
    (e) => {
      let v = e.target.value;
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
        for (let i = 0; i < seg.length - 1; i++) obj = obj[seg[i]];
        obj[seg.at(-1)] = num;
        return next;
      });
    };

  const handleSave = async () => {
    try {
      const payload = {
        maintenance: {
          enabled: form.maintenance?.enabled,
          message: form.maintenance?.message ?? "",
        },
        registration: { open: form.registration?.open },
        kyc: {
          enabled: form.kyc?.enabled,
          autoApprove: form.kyc?.autoApprove, // ⬅️ switch auto-approve
          faceMatchThreshold: form.kyc?.faceMatchThreshold,
        },
        security: {
          enforce2FAForAdmins: form.security?.enforce2FAForAdmins,
          sessionTTLHours: form.security?.sessionTTLHours,
        },
        uploads: { maxAvatarSizeMB: form.uploads?.maxAvatarSizeMB },
        notifications: {
          telegramEnabled: form.notifications?.telegramEnabled,
          telegramComplaintChatId: form.notifications?.telegramComplaintChatId ?? "",
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

  // ===== Loading: hiển thị skeleton + giữ spinner nhỏ ở góc
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
            <SectionSkeleton lines={1} />
            <SectionSkeleton lines={2} />
            <SectionSkeleton lines={1} />
            <SectionSkeleton lines={1} />
          </Stack>

          {/* giữ nguyên spinner cũ nhưng thu nhỏ & đặt góc phải */}
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
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
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
                onChange={onNumber("kyc.faceMatchThreshold", { min: 0, max: 1, step: 0.01 })}
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

          <Section title="Đăng ký tài khoản" desc="Mở/đóng đăng ký người dùng mới.">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Cho phép đăng ký mới</Typography>
              <Switch
                checked={!!form.registration?.open}
                onChange={onToggle("registration.open")}
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
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
