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
} from "@mui/material";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useGetContactContentQuery, useUpdateContactContentMutation } from "slices/cmsApiSlice";

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

  const onSave = async () => {
    try {
      // BE expects { data: ... } → hook đã bọc sẵn
      await updateContact(form).unwrap();
      toast.success("Lưu liên hệ thành công");
      await refetch();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lưu thất bại");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          CMS Contact
        </Typography>

        {error && <Alert severity="error">{error?.data?.message || error.error}</Alert>}

        <Card variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Địa chỉ"
                fullWidth
                value={form.address}
                onChange={setField("address")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Điện thoại"
                fullWidth
                value={form.phone}
                onChange={setField("phone")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Email" fullWidth value={form.email} onChange={setField("email")} />
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
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Hỗ trợ (điện thoại)"
                fullWidth
                value={form.support.generalPhone}
                onChange={setSupport("generalPhone")}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Hỗ trợ điểm trình (email)"
                fullWidth
                value={form.support.scoringEmail}
                onChange={setSupport("scoringEmail")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Hỗ trợ điểm trình (điện thoại)"
                fullWidth
                value={form.support.scoringPhone}
                onChange={setSupport("scoringPhone")}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Bán hàng (email)"
                fullWidth
                value={form.support.salesEmail}
                onChange={setSupport("salesEmail")}
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
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="YouTube URL"
                fullWidth
                value={form.socials.youtube}
                onChange={setSocial("youtube")}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Zalo URL"
                fullWidth
                value={form.socials.zalo}
                onChange={setSocial("zalo")}
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} mt={3}>
            <Button variant="contained" onClick={onSave} disabled={saving || isLoading}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button variant="outlined" onClick={() => refetch()} disabled={saving || isLoading}>
              Tải lại
            </Button>
          </Stack>
        </Card>
      </Container>
    </DashboardLayout>
  );
}
