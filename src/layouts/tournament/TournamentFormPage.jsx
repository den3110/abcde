// src/pages/TournamentFormPage.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, Grid, TextField, Typography, Stack, MenuItem, Card } from "@mui/material";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import {
  useCreateTournamentMutation,
  useGetTournamentQuery,
  useUpdateTournamentMutation,
  useUploadAvatarMutation,
} from "../../slices/tournamentsApiSlice";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

dayjs.extend(customParseFormat);

const MAX_IMG_SIZE = 10 * 1024 * 1024; // 10MB

// ===== Helpers cho định dạng ngày =====
const toDDMMYYYY = (ymd) => (ymd ? dayjs(ymd, "YYYY-MM-DD", true).format("DD/MM/YYYY") : "");
const toYYYYMMDD = (dmy) => {
  const d = dayjs(dmy, "DD/MM/YYYY", true);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};
const isFullValidDmy = (dmy) => dayjs(dmy, "DD/MM/YYYY", true).isValid();

export default function TournamentFormPage() {
  const { id } = useParams(); // "new" | <id>
  const isEdit = !!id && id !== "new";
  const { data: tour } = useGetTournamentQuery(id, { skip: !isEdit });

  const [createTour] = useCreateTournamentMutation();
  const [updateTour] = useUpdateTournamentMutation();
  const [uploadAvatar] = useUploadAvatarMutation();

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const todayYmd = dayjs().format("YYYY-MM-DD");

  // State submit (backend): giữ YYYY-MM-DD + HTML cho 2 trường quill
  const [form, setForm] = useState({
    name: "",
    image: "",
    sportType: 1,
    groupId: 0,
    eventType: "double",
    regOpenDate: todayYmd,
    registrationDeadline: todayYmd,
    startDate: todayYmd,
    endDate: todayYmd,
    scoreCap: 0,
    scoreGap: 0,
    singleCap: 0,
    location: "",
    contactHtml: "",
    contentHtml: "",
    maxPairs: 0,
  });

  // State hiển thị (frontend): giữ DD/MM/YYYY cho 4 field ngày
  const [uiDates, setUiDates] = useState({
    regOpenDate: toDDMMYYYY(todayYmd),
    registrationDeadline: toDDMMYYYY(todayYmd),
    startDate: toDDMMYYYY(todayYmd),
    endDate: toDDMMYYYY(todayYmd),
  });

  const [uploading, setUploading] = useState(false);

  // Toolbar cho Quill
  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }, { indent: "-1" }, { indent: "+1" }],
        ["link", "blockquote", "code-block"],
        ["clean"],
      ],
      clipboard: { matchVisual: false },
    }),
    []
  );

  const quillFormats = useMemo(
    () => [
      "header",
      "bold",
      "italic",
      "underline",
      "strike",
      "list",
      "bullet",
      "indent",
      "link",
      "blockquote",
      "code-block",
      "align",
      "color",
      "background",
    ],
    []
  );

  // Map dữ liệu server -> state
  useEffect(() => {
    if (!tour) return;
    const nextForm = {
      name: tour.name || "",
      image: tour.image || "",
      sportType: 1,
      groupId: Number(tour.groupId ?? 0),
      eventType: tour.eventType || "double",
      regOpenDate: dayjs(tour.regOpenDate).isValid()
        ? dayjs(tour.regOpenDate).format("YYYY-MM-DD")
        : todayYmd,
      registrationDeadline: dayjs(tour.registrationDeadline).isValid()
        ? dayjs(tour.registrationDeadline).format("YYYY-MM-DD")
        : todayYmd,
      startDate: dayjs(tour.startDate).isValid()
        ? dayjs(tour.startDate).format("YYYY-MM-DD")
        : todayYmd,
      endDate: dayjs(tour.endDate).isValid() ? dayjs(tour.endDate).format("YYYY-MM-DD") : todayYmd,
      scoreCap: Number(tour.scoreCap ?? 0),
      scoreGap: Number(tour.scoreGap ?? 0),
      singleCap: Number(tour.singleCap ?? 0),
      maxPairs: Number(tour.maxPairs ?? 0),
      location: tour.location || "",
      contactHtml: tour.contactHtml || "",
      contentHtml: tour.contentHtml || "",
    };
    setForm(nextForm);
    setUiDates({
      regOpenDate: toDDMMYYYY(nextForm.regOpenDate),
      registrationDeadline: toDDMMYYYY(nextForm.registrationDeadline),
      startDate: toDDMMYYYY(nextForm.startDate),
      endDate: toDDMMYYYY(nextForm.endDate),
    });
  }, [tour]);

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Xử lý nhập ngày dạng dd/mm/yyyy, chỉ set vào form (yyyy-mm-dd) khi hợp lệ.
  const onDateChange = (name) => (e) => {
    const raw = e.target.value;
    // giữ UI
    setUiDates((prev) => ({ ...prev, [name]: raw }));
    // nếu hợp lệ đầy đủ -> cập nhật form (yyyy-mm-dd)
    if (isFullValidDmy(raw)) {
      setForm((prev) => ({ ...prev, [name]: toYYYYMMDD(raw) }));
    }
  };

  const buildPayload = () => ({
    name: (form.name || "").trim(),
    image: form.image || "",
    sportType: 1,
    groupId: Number(form.groupId) || 0,
    eventType: form.eventType,
    regOpenDate: form.regOpenDate,
    registrationDeadline: form.registrationDeadline,
    startDate: form.startDate,
    endDate: form.endDate,
    scoreCap: Number(form.scoreCap) || 0,
    scoreGap: Number(form.scoreGap) || 0,
    singleCap: Number(form.singleCap) || 0,
    location: form.location,
    contactHtml: form.contactHtml,
    contentHtml: form.contentHtml,
    maxPairs: Number(form.maxPairs) || 0,
  });

  const submit = async (e) => {
    e.preventDefault();

    // Validate 4 ngày lần cuối
    const dateFields = ["regOpenDate", "registrationDeadline", "startDate", "endDate"];
    for (const f of dateFields) {
      if (!form[f] || !dayjs(form[f], "YYYY-MM-DD", true).isValid()) {
        toast.error(`Ngày không hợp lệ ở trường: ${f}`);
        return;
      }
    }

    const body = buildPayload();
    try {
      if (isEdit) {
        await updateTour({ id, body }).unwrap();
        toast.success("Cập nhật thành công");
      } else {
        await createTour(body).unwrap();
        toast.success("Tạo mới thành công");
      }
      navigate("/admin/tournaments");
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Có lỗi xảy ra");
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn đúng file ảnh (PNG/JPG/WebP...)");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMG_SIZE) {
      toast.error("Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);
      const res = await uploadAvatar(file).unwrap();
      const url =
        res?.url || res?.path || res?.secure_url || res?.data?.url || res?.data?.path || "";
      if (!url) throw new Error("Không tìm thấy URL ảnh từ server");

      setForm((prev) => ({ ...prev, image: url }));
      toast.success("Tải ảnh thành công");
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Upload ảnh thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const clearImage = () => setForm((prev) => ({ ...prev, image: "" }));

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box p={3} sx={{ backgroundColor: "#fff", borderRadius: 1 }}>
        <Typography variant="h4" mb={3}>
          {isEdit ? "Sửa Giải đấu" : "Tạo Giải đấu"}
        </Typography>

        <Box
          component="form"
          onSubmit={submit}
          sx={{ "& .MuiInputBase-root": { minHeight: 50, alignItems: "center" } }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                name="name"
                label="Tên giải"
                value={form.name}
                onChange={onChange}
                fullWidth
                required
                margin="normal"
              />

              {/* Upload ảnh từ máy + preview */}
              <Card variant="outlined" sx={{ p: 2, mt: 2, display: "grid", gap: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Ảnh đại diện giải
                </Typography>

                {form.image ? (
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                    <img
                      src={form.image}
                      referrerPolicy="no-referrer"
                      alt="preview"
                      style={{
                        width: 160,
                        height: 90,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.12)",
                      }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={pickFile} disabled={uploading}>
                        {uploading ? "Đang tải..." : "Thay ảnh"}
                      </Button>
                      <Button
                        variant="text"
                        color="error"
                        onClick={clearImage}
                        disabled={uploading}
                      >
                        Xoá ảnh
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button variant="outlined" onClick={pickFile} disabled={uploading}>
                      {uploading ? "Đang tải..." : "Chọn ảnh từ máy"}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      PNG/JPG/WebP • ≤ 10MB. Sau khi chọn sẽ tự upload.
                    </Typography>
                  </Stack>
                )}

                {/* file input ẩn */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />

                {/* Nhập URL thủ công nếu muốn */}
                <TextField
                  name="image"
                  label="Ảnh (URL)"
                  value={form.image}
                  onChange={onChange}
                  fullWidth
                  margin="normal"
                  helperText="Có thể dán URL ảnh trực tiếp nếu đã có."
                />
              </Card>

              <TextField
                name="sportType"
                label="Môn thi"
                value="Pickleball"
                fullWidth
                margin="normal"
                InputProps={{ readOnly: true }}
              />
              <TextField
                name="groupId"
                label="Group ID"
                type="number"
                value={form.groupId}
                onChange={onChange}
                fullWidth
                margin="normal"
              />
              <TextField
                name="eventType"
                label="Loại giải"
                select
                value={form.eventType}
                onChange={onChange}
                fullWidth
                margin="normal"
              >
                <MenuItem value="single">Đơn</MenuItem>
                <MenuItem value="double">Đôi</MenuItem>
              </TextField>
              <TextField
                name="location"
                label="Địa điểm"
                value={form.location}
                onChange={onChange}
                fullWidth
                margin="normal"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              {[
                { n: "regOpenDate", l: "Ngày mở đăng ký" },
                { n: "registrationDeadline", l: "Hạn chót đăng ký" },
                { n: "startDate", l: "Ngày thi đấu" },
                { n: "endDate", l: "Ngày kết thúc" },
              ].map((d) => (
                <TextField
                  key={d.n}
                  name={d.n}
                  label={`${d.l} (dd/mm/yyyy)`}
                  placeholder="dd/mm/yyyy"
                  value={uiDates[d.n]}
                  onChange={onDateChange(d.n)}
                  fullWidth
                  margin="normal"
                  inputProps={{ inputMode: "numeric" }}
                />
              ))}

              {[
                { n: "scoreCap", l: "Tổng điểm tối đa (đôi)" },
                { n: "scoreGap", l: "Chênh lệch tối đa" },
                { n: "singleCap", l: "Điểm tối đa 1 VĐV" },
                { n: "maxPairs", l: "Số cặp/đội tối đa" },
              ].map((s) => (
                <TextField
                  key={s.n}
                  name={s.n}
                  label={s.l}
                  type="number"
                  value={form[s.n]}
                  onChange={onChange}
                  fullWidth
                  margin="normal"
                />
              ))}
            </Grid>

            {/* ==== ReactQuill Editors ==== */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Thông tin liên hệ
              </Typography>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  "& .ql-container": { border: "none" },
                  "& .ql-toolbar": { border: "none", borderBottom: "1px solid #eee" },
                  "& .ql-editor": { minHeight: 150 },
                }}
              >
                <ReactQuill
                  theme="snow"
                  value={form.contactHtml}
                  onChange={(html) => setForm((p) => ({ ...p, contactHtml: html }))}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Nhập thông tin liên hệ…"
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Nội dung giải
              </Typography>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  "& .ql-container": { border: "none" },
                  "& .ql-toolbar": { border: "none", borderBottom: "1px solid #eee" },
                  "& .ql-editor": { minHeight: 200 },
                }}
              >
                <ReactQuill
                  theme="snow"
                  value={form.contentHtml}
                  onChange={(html) => setForm((p) => ({ ...p, contentHtml: html }))}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Mô tả chi tiết thể lệ, cơ cấu giải thưởng, lưu ý…"
                />
              </Box>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} mt={3}>
            <Button
              type="submit"
              variant="contained"
              disabled={uploading}
              sx={{
                backgroundColor: "#1976d2",
                color: "#fff",
                "&:hover": { backgroundColor: "#1565c0" },
              }}
            >
              {isEdit ? "Cập nhật" : "Tạo mới"}
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)} disabled={uploading}>
              Huỷ
            </Button>
          </Stack>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
