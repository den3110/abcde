// src/pages/admin/CmsContactEditor.jsx
import { useEffect, useState, useRef } from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  TextField,
  Card,
  Stack,
  Button,
  Divider,
  Alert,
  Skeleton,
  // LinearProgress, // nếu muốn dùng thì bật lại
} from "@mui/material";
import PropTypes from "prop-types";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useGetContactContentQuery, useUpdateContactContentMutation } from "slices/cmsApiSlice";

/* ===== Helpers ===== */
const FieldSkeleton = ({ height = 56 }) => (
  <Skeleton variant="rounded" height={height} sx={{ width: "100%" }} />
);
FieldSkeleton.propTypes = { height: PropTypes.number };

/* Deep merge cho 2 nhánh lồng */
const mergeContact = (prev, src = {}) => ({
  ...prev,
  ...src,
  support: {
    ...prev.support,
    ...(src.support || {}),
  },
  socials: {
    ...prev.socials,
    ...(src.socials || {}),
  },
  apps: {
    ...prev.apps,
    ...(src.apps || {}),
  },
});

export default function CmsContactEditor() {
  const { data, isLoading, error, refetch } = useGetContactContentQuery();
  const [updateContact, { isLoading: saving }] = useUpdateContactContentMutation();

  const [form, setForm] = useState({
    address: "",
    phone: "",
    email: "",
    support: {
      generalEmail: "",
      generalPhone: "",
      scoringEmail: "",
      scoringPhone: "",
      salesEmail: "",
    },
    socials: { facebook: "", youtube: "", zalo: "" },
    // 🆕 Thêm field app download
    apps: {
      appStore: "",
      playStore: "",
      apkPickleTour: "",
      apkReferee: "",
      liveAppIos: "",
      liveAppApk: "",
    },
  });

  // Chỉ hydrate 1 lần để tránh overwrite khi user đã gõ
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current && data) {
      setForm((f) => mergeContact(f, data));
      hydratedRef.current = true;
    }
  }, [data]);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const setSupport = (k) => (e) =>
    setForm((f) => ({ ...f, support: { ...f.support, [k]: e.target.value } }));
  const setSocial = (k) => (e) =>
    setForm((f) => ({ ...f, socials: { ...f.socials, [k]: e.target.value } }));
  const setApp = (k) => (e) => setForm((f) => ({ ...f, apps: { ...f.apps, [k]: e.target.value } }));

  const onSave = async () => {
    try {
      await updateContact(form).unwrap(); // BE nhận full object
      toast.success("Lưu liên hệ thành công");
      await refetch();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lưu thất bại");
    }
  };

  const showSkeleton = isLoading && !hydratedRef.current; // chỉ skeleton khi chưa hydrate
  const disabledAll = isLoading || saving;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h5" fontWeight={700}>
            CMS Contact
          </Typography>
          {(saving || isLoading) && (
            <Typography variant="body2" color="text.secondary">
              {saving ? "Đang lưu..." : "Đang tải..."}
            </Typography>
          )}
        </Stack>

        {/* {(saving || isLoading) && <LinearProgress sx={{ mb: 2 }} />} */}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error?.data?.message || error.error}
          </Alert>
        )}

        <Card variant="outlined" sx={{ p: 2 }}>
          {showSkeleton ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>

              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>

              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              <Grid item xs={12} md={4}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={4}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={4}>
                <FieldSkeleton />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>

              {/* Skeleton cho 2 field APK */}
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>
              <Grid item xs={12} md={6}>
                <FieldSkeleton />
              </Grid>

              <Grid item xs={12}>
                <Stack direction="row" spacing={2} mt={1}>
                  <Skeleton variant="rounded" width={120} height={36} />
                  <Skeleton variant="rounded" width={100} height={36} />
                </Stack>
              </Grid>
            </Grid>
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Địa chỉ"
                    fullWidth
                    value={form.address}
                    onChange={setField("address")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Điện thoại"
                    fullWidth
                    value={form.phone}
                    onChange={setField("phone")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Email"
                    fullWidth
                    value={form.email}
                    onChange={setField("email")}
                    disabled={disabledAll}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Hỗ trợ (email)"
                    fullWidth
                    value={form.support.generalEmail}
                    onChange={setSupport("generalEmail")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Hỗ trợ (điện thoại)"
                    fullWidth
                    value={form.support.generalPhone}
                    onChange={setSupport("generalPhone")}
                    disabled={disabledAll}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Hỗ trợ điểm trình (email)"
                    fullWidth
                    value={form.support.scoringEmail}
                    onChange={setSupport("scoringEmail")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Hỗ trợ điểm trình (điện thoại)"
                    fullWidth
                    value={form.support.scoringPhone}
                    onChange={setSupport("scoringPhone")}
                    disabled={disabledAll}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Bán hàng (email)"
                    fullWidth
                    value={form.support.salesEmail}
                    onChange={setSupport("salesEmail")}
                    disabled={disabledAll}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Facebook URL"
                    fullWidth
                    value={form.socials.facebook}
                    onChange={setSocial("facebook")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="YouTube URL"
                    fullWidth
                    value={form.socials.youtube}
                    onChange={setSocial("youtube")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Zalo URL"
                    fullWidth
                    value={form.socials.zalo}
                    onChange={setSocial("zalo")}
                    disabled={disabledAll}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                {/* Liên kết cửa hàng ứng dụng */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="App Store URL (iOS)"
                    placeholder="https://apps.apple.com/app/idXXXXXXXXX"
                    fullWidth
                    value={form.apps.appStore}
                    onChange={setApp("appStore")}
                    disabled={disabledAll}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Google Play URL (Android)"
                    placeholder="https://play.google.com/store/apps/details?id=..."
                    fullWidth
                    value={form.apps.playStore}
                    onChange={setApp("playStore")}
                    disabled={disabledAll}
                  />
                </Grid>

                {/* 🆕 Link APK sideload */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="APK PickleTour (Android - sideload)"
                    placeholder="https://your-domain/dl/file/XXXX"
                    fullWidth
                    value={form.apps.apkPickleTour}
                    onChange={setApp("apkPickleTour")}
                    disabled={disabledAll}
                    helperText="Dán link public từ trang Quản lý file (/dl/file/:id)"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="APK Trọng tài (Android - sideload)"
                    placeholder="https://your-domain/dl/file/XXXX"
                    fullWidth
                    value={form.apps.apkReferee}
                    onChange={setApp("apkReferee")}
                    disabled={disabledAll}
                    helperText="Dán link public từ trang Quản lý file (/dl/file/:id)"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="iOS App Live URL"
                    placeholder="https://apps.apple.com/app/idXXXXXXXXX"
                    fullWidth
                    value={form.apps.liveAppIos}
                    onChange={setApp("liveAppIos")}
                    disabled={disabledAll}
                    helperText="Link App Store của PickleTour Live"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="APK App Live URL"
                    placeholder="https://your-domain/dl/file/XXXX"
                    fullWidth
                    value={form.apps.liveAppApk}
                    onChange={setApp("liveAppApk")}
                    disabled={disabledAll}
                    helperText="Link APK public của PickleTour Live"
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={2} mt={3}>
                <Button variant="contained" onClick={onSave} disabled={disabledAll}>
                  {saving ? "Đang lưu..." : "Lưu"}
                </Button>
                <Button variant="outlined" onClick={() => refetch()} disabled={disabledAll}>
                  Tải lại
                </Button>
              </Stack>
            </>
          )}
        </Card>
      </Container>
    </DashboardLayout>
  );
}
