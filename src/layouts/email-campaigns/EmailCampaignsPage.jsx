/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Delete, Send, Cancel, Edit, Email as EmailIcon, Refresh } from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useGetEmailCampaignsQuery,
  useEstimateEmailAudienceMutation,
  useCreateEmailCampaignMutation,
  useUpdateEmailCampaignMutation,
  useSendTestEmailMutation,
  useSendEmailCampaignMutation,
  useCancelEmailCampaignMutation,
  useDeleteEmailCampaignMutation,
} from "slices/emailCampaignApiSlice";
import { useGetTournamentsQuery } from "slices/tournamentsApiSlice";

const STATUS = {
  draft: { label: "Nháp", color: "default" },
  queued: { label: "Đang chờ", color: "info" },
  running: { label: "Đang gửi", color: "warning" },
  completed: { label: "Hoàn tất", color: "success" },
  failed: { label: "Lỗi", color: "error" },
  canceled: { label: "Đã hủy", color: "default" },
};

const emptyForm = {
  id: null,
  name: "",
  subject: "",
  previewText: "",
  heading: "",
  bodyHtml: "",
  ctaText: "",
  ctaUrl: "",
  scope: "all",
  tournament: null,
  emailsText: "",
};

export default function EmailCampaignsPage() {
  const [form, setForm] = useState(emptyForm);
  const [estimate, setEstimate] = useState(null);
  const [testEmails, setTestEmails] = useState("");
  const [msg, setMsg] = useState(null); // {type,text}
  const [confirmSend, setConfirmSend] = useState(null); // campaign obj

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const { data: listData, isFetching: listLoading } = useGetEmailCampaignsQuery(
    { page: 1, limit: 20 },
    { pollingInterval: 5000 }
  );
  const campaigns = listData?.items || [];

  const { data: tourData } = useGetTournamentsQuery({});
  const tournaments = useMemo(() => {
    const raw = Array.isArray(tourData) ? tourData : tourData?.items || tourData?.tournaments || [];
    return raw.map((t) => ({ id: t._id || t.id, name: t.name || t.title || "(không tên)" }));
  }, [tourData]);

  const [estimateAudience, { isLoading: estLoading }] = useEstimateEmailAudienceMutation();
  const [createCampaign, { isLoading: creating }] = useCreateEmailCampaignMutation();
  const [updateCampaign, { isLoading: updating }] = useUpdateEmailCampaignMutation();
  const [sendTest, { isLoading: testing }] = useSendTestEmailMutation();
  const [sendCampaign, { isLoading: sending }] = useSendEmailCampaignMutation();
  const [cancelCampaign] = useCancelEmailCampaignMutation();
  const [deleteCampaign] = useDeleteEmailCampaignMutation();

  const buildAudience = () => ({
    scope: form.scope,
    tournament: form.scope === "tournament" ? form.tournament?.id || null : null,
    emails:
      form.scope === "list"
        ? form.emailsText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
        : [],
  });

  const buildPayload = () => ({
    name: form.name,
    subject: form.subject,
    previewText: form.previewText,
    heading: form.heading,
    bodyHtml: form.bodyHtml,
    ctaText: form.ctaText,
    ctaUrl: form.ctaUrl,
    audience: buildAudience(),
  });

  const flash = (type, text) => {
    setMsg({ type, text });
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setMsg(null), 4500);
  };

  const runEstimate = async () => {
    try {
      const r = await estimateAudience({ audience: buildAudience() }).unwrap();
      setEstimate(r.count);
    } catch (e) {
      flash("error", e?.data?.message || "Không ước lượng được");
    }
  };

  const saveDraft = async () => {
    if (!form.subject.trim()) return flash("error", "Nhập tiêu đề email");
    try {
      if (form.id) {
        await updateCampaign({ id: form.id, ...buildPayload() }).unwrap();
        flash("success", "Đã lưu chiến dịch");
      } else {
        const c = await createCampaign(buildPayload()).unwrap();
        setForm((f) => ({ ...f, id: c._id }));
        flash("success", "Đã tạo chiến dịch nháp");
      }
    } catch (e) {
      flash("error", e?.data?.message || "Lưu thất bại");
    }
  };

  const doTest = async () => {
    const emails = testEmails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!emails.length) return flash("error", "Nhập email để gửi thử");
    try {
      const r = await sendTest({ ...buildPayload(), emails }).unwrap();
      flash(r.ok ? "success" : "warning", r.ok ? "Đã gửi email thử" : "Một số email gửi lỗi");
    } catch (e) {
      flash("error", e?.data?.message || "Gửi thử lỗi");
    }
  };

  const openSend = async () => {
    // đảm bảo đã lưu trước khi gửi
    let id = form.id;
    try {
      if (!id) {
        const c = await createCampaign(buildPayload()).unwrap();
        id = c._id;
        setForm((f) => ({ ...f, id }));
      } else {
        await updateCampaign({ id, ...buildPayload() }).unwrap();
      }
    } catch (e) {
      return flash("error", e?.data?.message || "Lưu trước khi gửi thất bại");
    }
    const r = await estimateAudience({ audience: buildAudience() }).unwrap().catch(() => null);
    setConfirmSend({ id, count: r?.count ?? estimate ?? 0 });
  };

  const confirmSendNow = async () => {
    try {
      await sendCampaign(confirmSend.id).unwrap();
      flash("success", "Đã bắt đầu gửi chiến dịch");
      setConfirmSend(null);
    } catch (e) {
      flash("error", e?.data?.message || "Gửi thất bại");
      setConfirmSend(null);
    }
  };

  const loadInto = (c) => {
    setForm({
      id: c._id,
      name: c.name || "",
      subject: c.subject || "",
      previewText: c.previewText || "",
      heading: c.heading || "",
      bodyHtml: c.bodyHtml || "",
      ctaText: c.ctaText || "",
      ctaUrl: c.ctaUrl || "",
      scope: c.audience?.scope || "all",
      tournament: c.audience?.tournament
        ? tournaments.find((t) => t.id === c.audience.tournament) || {
            id: c.audience.tournament,
            name: "Giải đã chọn",
          }
        : null,
      emailsText: (c.audience?.emails || []).join("\n"),
    });
    setEstimate(c.audience?.estimatedCount ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
          <EmailIcon color="info" />
          <Typography variant="h4" fontWeight="bold">
            Chiến dịch gửi email
          </Typography>
        </Stack>
        <Typography variant="body2" color="text" mb={3}>
          Soạn và gửi email quảng cáo giải đấu tới người dùng bằng email của PickleTour.
        </Typography>

        {msg ? (
          <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        ) : null}

        <Grid container spacing={3}>
          {/* ---------- Composer ---------- */}
          <Grid item xs={12} lg={7}>
            <Card sx={{ p: 2.5 }}>
              <Typography variant="h6" mb={1.5}>
                {form.id ? "Chỉnh sửa chiến dịch" : "Soạn chiến dịch mới"}
              </Typography>
              <Stack spacing={2}>
                <TextField label="Tên chiến dịch (nội bộ)" value={form.name} onChange={set("name")} fullWidth size="small" />
                <TextField label="Tiêu đề email (Subject) *" value={form.subject} onChange={set("subject")} fullWidth size="small" />
                <TextField label="Preheader (dòng preview trong hộp thư)" value={form.previewText} onChange={set("previewText")} fullWidth size="small" />
                <TextField label="Tiêu đề lớn trong email (Heading)" value={form.heading} onChange={set("heading")} fullWidth size="small" />
                <TextField
                  label="Nội dung (HTML) *"
                  value={form.bodyHtml}
                  onChange={set("bodyHtml")}
                  fullWidth
                  multiline
                  minRows={6}
                  size="small"
                  helperText="Cho phép HTML: <p>, <b>, <a href>, <ul>… Nội dung được bọc trong khung email PickleTour."
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Nút CTA — chữ" value={form.ctaText} onChange={set("ctaText")} fullWidth size="small" />
                  <TextField label="Nút CTA — liên kết" value={form.ctaUrl} onChange={set("ctaUrl")} fullWidth size="small" placeholder="https://pickletour.vn/..." />
                </Stack>

                <Divider />
                <Typography variant="subtitle2">Đối tượng nhận</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={form.scope}
                  onChange={(e, v) => {
                    if (v) {
                      setForm((f) => ({ ...f, scope: v }));
                      setEstimate(null);
                    }
                  }}
                >
                  <ToggleButton value="all">Tất cả người dùng</ToggleButton>
                  <ToggleButton value="tournament">Theo giải đấu</ToggleButton>
                  <ToggleButton value="list">Danh sách email</ToggleButton>
                </ToggleButtonGroup>

                {form.scope === "tournament" ? (
                  <Autocomplete
                    options={tournaments}
                    getOptionLabel={(o) => o?.name || ""}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    value={form.tournament}
                    onChange={(e, v) => {
                      setForm((f) => ({ ...f, tournament: v }));
                      setEstimate(null);
                    }}
                    renderInput={(p) => <TextField {...p} size="small" label="Chọn giải đấu" />}
                  />
                ) : null}
                {form.scope === "list" ? (
                  <TextField
                    label="Danh sách email (cách nhau bởi xuống dòng/dấu phẩy)"
                    value={form.emailsText}
                    onChange={set("emailsText")}
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                  />
                ) : null}

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button variant="outlined" onClick={runEstimate} disabled={estLoading} startIcon={estLoading ? <CircularProgress size={16} /> : null}>
                    Ước lượng người nhận
                  </Button>
                  {estimate != null ? (
                    <Chip color="info" label={`${estimate.toLocaleString("vi-VN")} người nhận`} />
                  ) : null}
                </Stack>

                <Divider />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                  <TextField label="Email gửi thử" value={testEmails} onChange={(e) => setTestEmails(e.target.value)} size="small" sx={{ flex: 1 }} placeholder="ban@pickletour.vn" />
                  <Button variant="text" onClick={doTest} disabled={testing}>
                    {testing ? "Đang gửi…" : "Gửi thử"}
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                  {form.id ? (
                    <Button color="secondary" onClick={() => { setForm(emptyForm); setEstimate(null); }}>
                      Tạo mới
                    </Button>
                  ) : null}
                  <Button variant="outlined" onClick={saveDraft} disabled={creating || updating}>
                    {form.id ? "Lưu" : "Lưu nháp"}
                  </Button>
                  <Button variant="contained" color="info" startIcon={<Send />} onClick={openSend} disabled={sending} sx={{ color: "#fff !important" }}>
                    Gửi chiến dịch
                  </Button>
                </Stack>
              </Stack>
            </Card>

            {/* preview */}
            <Card sx={{ p: 2.5, mt: 2.5 }}>
              <Typography variant="h6" mb={1.5}>Xem trước</Typography>
              <Box sx={{ background: "#f6f8fb", borderRadius: 2, p: 2 }}>
                <Box sx={{ maxWidth: 520, mx: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 2, p: 2.5 }}>
                  <Box sx={{ display: "inline-block", px: 1.2, py: 0.6, background: "#0FA9A2", color: "#fff", borderRadius: 1.5, fontWeight: 700, fontSize: 13, mb: 1.5 }}>PickleTour</Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>{form.heading || form.subject || "Tiêu đề email"}</Typography>
                  <Box sx={{ fontSize: 14, lineHeight: 1.7, color: "#1f2937" }} dangerouslySetInnerHTML={{ __html: form.bodyHtml || "<p style='color:#9ca3af'>Nội dung email hiển thị ở đây…</p>" }} />
                  {form.ctaText ? (
                    <Box sx={{ mt: 2, display: "inline-block", px: 2.2, py: 1.2, background: "#1976d2", color: "#fff", borderRadius: 1.5, fontWeight: 600, fontSize: 14 }}>{form.ctaText}</Box>
                  ) : null}
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* ---------- List ---------- */}
          <Grid item xs={12} lg={5}>
            <Card sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Typography variant="h6">Chiến dịch gần đây</Typography>
                {listLoading ? <Refresh sx={{ opacity: 0.5 }} fontSize="small" /> : null}
              </Stack>
              <Stack spacing={1.5}>
                {campaigns.length === 0 ? (
                  <Typography variant="body2" color="text">Chưa có chiến dịch nào.</Typography>
                ) : null}
                {campaigns.map((c) => {
                  const st = STATUS[c.status] || STATUS.draft;
                  const total = c.progress?.total || c.audience?.estimatedCount || 0;
                  const sent = c.progress?.sent || 0;
                  const pct = total ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                  const running = ["queued", "running"].includes(c.status);
                  return (
                    <Box key={c._id} sx={{ border: "1px solid", borderColor: "grey.300", borderRadius: 2, p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="button" fontWeight="bold" sx={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.name || c.subject}
                          </Typography>
                          <Typography variant="caption" color="text">{c.subject}</Typography>
                        </Box>
                        <Chip size="small" color={st.color} label={st.label} />
                      </Stack>
                      <Typography variant="caption" color="text" sx={{ display: "block", mt: 0.5 }}>
                        {c.audience?.scope === "all" ? "Tất cả người dùng" : c.audience?.scope === "tournament" ? "Theo giải đấu" : "Danh sách email"}
                        {" · "}
                        {(total || 0).toLocaleString("vi-VN")} người nhận
                      </Typography>
                      {(running || c.status === "completed") && total ? (
                        <Box mt={1}>
                          <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
                          <Typography variant="caption" color="text">
                            Đã gửi {sent.toLocaleString("vi-VN")}/{total.toLocaleString("vi-VN")}
                            {c.progress?.failed ? ` · lỗi ${c.progress.failed}` : ""}
                          </Typography>
                        </Box>
                      ) : null}
                      <Stack direction="row" spacing={0.5} mt={1} justifyContent="flex-end">
                        <Tooltip title="Nạp vào trình soạn">
                          <IconButton size="small" onClick={() => loadInto(c)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                        {running ? (
                          <Tooltip title="Hủy gửi">
                            <IconButton size="small" color="warning" onClick={() => cancelCampaign(c._id)}><Cancel fontSize="small" /></IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Xóa">
                            <IconButton size="small" color="error" onClick={() => deleteCampaign(c._id)}><Delete fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog open={!!confirmSend} onClose={() => setConfirmSend(null)}>
        <DialogTitle>Gửi chiến dịch email?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Email sẽ được gửi tới <b>{(confirmSend?.count || 0).toLocaleString("vi-VN")}</b> người nhận
            bằng email của PickleTour. Thao tác này <b>không thể hoàn tác</b> sau khi bắt đầu.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSend(null)}>Hủy</Button>
          <Button variant="contained" color="info" onClick={confirmSendNow} disabled={sending} sx={{ color: "#fff !important" }}>
            {sending ? "Đang gửi…" : "Gửi ngay"}
          </Button>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}
