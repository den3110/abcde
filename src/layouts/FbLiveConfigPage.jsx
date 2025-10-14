import { useEffect, useMemo, useState } from "react";
import {
  useGetFbLiveConfigQuery,
  useUpdateFbLiveConfigMutation,
} from "slices/fbLiveConfigApiSlice";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Stack,
  Snackbar,
  Alert,
} from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

export default function FbLiveConfigPage() {
  const { data, isLoading, isError } = useGetFbLiveConfigQuery();
  const [updateCfg, { isLoading: saving }] = useUpdateFbLiveConfigMutation();

  const [status, setStatus] = useState("LIVE_NOW");
  const [privacyValueOnCreate, setPrivacy] = useState("EVERYONE");
  const [embeddable, setEmbeddable] = useState(true);
  const [ensurePrivacyAfterEnd, setEnsureAfterEnd] = useState("EVERYONE");

  const [toast, setToast] = useState({ open: false, msg: "", type: "success" });

  useEffect(() => {
    if (data) {
      setStatus(data.status ?? "LIVE_NOW");
      setPrivacy(data.privacyValueOnCreate ?? "EVERYONE");
      setEmbeddable(data.embeddable ?? true);
      setEnsureAfterEnd(data.ensurePrivacyAfterEnd ?? "EVERYONE");
    }
  }, [data]);

  const handleSave = async () => {
    try {
      await updateCfg({ status, privacyValueOnCreate, embeddable, ensurePrivacyAfterEnd }).unwrap();
      setToast({ open: true, msg: "Đã lưu cấu hình.", type: "success" });
    } catch (e) {
      setToast({ open: true, msg: e?.data?.message || "Lỗi lưu cấu hình", type: "error" });
    }
  };

  if (isLoading) return <Box p={3}>Đang tải…</Box>;
  if (isError) return <Box p={3}>Lỗi tải cấu hình</Box>;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3} maxWidth={720} mx="auto">
        <Card>
          <CardHeader
            title="Cấu hình Facebook Live"
            subheader="Chỉ áp dụng status, phạm vi hiển thị và khả năng nhúng. Không chạm title/description/token."
          />
          <CardContent>
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel id="status-label">Trạng thái mặc định</InputLabel>
                <Select
                  labelId="status-label"
                  label="Trạng thái mặc định"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="LIVE_NOW">LIVE_NOW (phát ngay)</MenuItem>
                  <MenuItem value="SCHEDULED_UNPUBLISHED">SCHEDULED_UNPUBLISHED (hẹn giờ)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="privacy-label">Phạm vi (khi tạo)</InputLabel>
                <Select
                  labelId="privacy-label"
                  label="Phạm vi (khi tạo)"
                  value={privacyValueOnCreate}
                  onChange={(e) => setPrivacy(e.target.value)}
                >
                  <MenuItem value="EVERYONE">EVERYONE (Public)</MenuItem>
                  <MenuItem value="FRIENDS">FRIENDS</MenuItem>
                  <MenuItem value="ALL_FRIENDS">ALL_FRIENDS</MenuItem>
                  <MenuItem value="SELF">SELF (Only me)</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch checked={embeddable} onChange={(e) => setEmbeddable(e.target.checked)} />
                }
                label="Cho phép nhúng (embeddable)"
              />

              <FormControl fullWidth>
                <InputLabel id="after-label">Phạm vi sau khi kết thúc</InputLabel>
                <Select
                  labelId="after-label"
                  label="Phạm vi sau khi kết thúc"
                  value={ensurePrivacyAfterEnd}
                  onChange={(e) => setEnsureAfterEnd(e.target.value)}
                >
                  <MenuItem value="EVERYONE">EVERYONE (Public)</MenuItem>
                  <MenuItem value="FRIENDS">FRIENDS</MenuItem>
                  <MenuItem value="ALL_FRIENDS">ALL_FRIENDS</MenuItem>
                  <MenuItem value="SELF">SELF (Only me)</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {saving ? "Đang lưu…" : "Lưu cấu hình"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Snackbar
          open={toast.open}
          autoHideDuration={3000}
          onClose={() => setToast({ ...toast, open: false })}
        >
          <Alert severity={toast.type} onClose={() => setToast({ ...toast, open: false })}>
            {toast.msg}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
