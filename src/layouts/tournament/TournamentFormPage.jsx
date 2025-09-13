// src/pages/TournamentFormPage.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Stack,
  MenuItem,
  Card,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

// === MUI X Date Pickers v5 ===
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

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
const YMD = "YYYY-MM-DD";
const DMY = "DD/MM/YYYY";
const isValidYmd = (s) => !!s && dayjs(s, YMD, true).isValid();

export default function TournamentFormPage() {
  const { id } = useParams(); // "new" | <id>
  const isEdit = !!id && id !== "new";
  const { data: tour } = useGetTournamentQuery(id, { skip: !isEdit });

  const [createTour] = useCreateTournamentMutation();
  const [updateTour] = useUpdateTournamentMutation();
  const [uploadAvatar] = useUploadAvatarMutation();

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const todayYmd = dayjs().format(YMD);

  // ---- State submit (YYYY-MM-DD + HTML) ----
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
    noRankDelta: false,
  });

  const [uploading, setUploading] = useState(false);

  // ====== Quill refs để chèn ảnh đúng editor ======
  const contactQuillRef = useRef(null);
  const contentQuillRef = useRef(null);

  // ====== Image uploader dùng slice upload avatar ======
  const uploadImageAndGetUrl = async (file) => {
    if (!file) return null;
    if (!file.type?.startsWith("image/")) {
      toast.error("Vui lòng chọn đúng file ảnh (PNG/JPG/WebP...)");
      return null;
    }
    if (file.size > MAX_IMG_SIZE) {
      toast.error("Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      return null;
    }
    try {
      setUploading(true);
      const res = await uploadAvatar(file).unwrap();
      const url =
        res?.url || res?.path || res?.secure_url || res?.data?.url || res?.data?.path || "";
      if (!url) throw new Error("Không tìm thấy URL ảnh từ server");
      return url;
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Upload ảnh thất bại");
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ====== Handler chèn ảnh cho Quill (tạo input file tạm thời) ======
  const insertImageViaUpload = (quillRef) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      const url = await uploadImageAndGetUrl(file);
      if (!url) return;

      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      quill.insertEmbed(range.index, "image", url, "user");
      quill.setSelection(range.index + 1, 0);
      toast.success("Chèn ảnh thành công");
    };
    input.click();
  };

  // ====== Quill toolbar cấu hình + handler image ======
  const makeQuillModules = (targetRef) => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }, { indent: "-1" }, { indent: "+1" }],
        ["link", "blockquote", "code-block", "image"],
        ["clean"],
      ],
      handlers: { image: () => insertImageViaUpload(targetRef) },
    },
    clipboard: { matchVisual: false },
  });

  // ✅ Memo hóa modules cho từng editor (bị thiếu ở bản bạn gửi)
  const contactModules = useMemo(() => makeQuillModules(contactQuillRef), []);
  const contentModules = useMemo(() => makeQuillModules(contentQuillRef), []);

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
      "image",
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
        ? dayjs(tour.regOpenDate).format(YMD)
        : todayYmd,
      registrationDeadline: dayjs(tour.registrationDeadline).isValid()
        ? dayjs(tour.registrationDeadline).format(YMD)
        : todayYmd,
      startDate: dayjs(tour.startDate).isValid() ? dayjs(tour.startDate).format(YMD) : todayYmd,
      endDate: dayjs(tour.endDate).isValid() ? dayjs(tour.endDate).format(YMD) : todayYmd,
      scoreCap: Number(tour.scoreCap ?? 0),
      scoreGap: Number(tour.scoreGap ?? 0),
      singleCap: Number(tour.singleCap ?? 0),
      maxPairs: Number(tour.maxPairs ?? 0),
      location: tour.location || "",
      contactHtml: tour.contactHtml || "",
      contentHtml: tour.contentHtml || "",
      noRankDelta: !!tour.noRankDelta,
    };
    setForm(nextForm);
  }, [tour]);

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Helper build payload
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
    noRankDelta: !!form.noRankDelta,
  });

  const submit = async (e) => {
    e.preventDefault();

    // Validate 4 ngày lần cuối
    const dateFields = ["regOpenDate", "registrationDeadline", "startDate", "endDate"];
    for (const f of dateFields) {
      if (!isValidYmd(form[f])) {
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
    const url = await uploadImageAndGetUrl(file);
    if (url) {
      setForm((prev) => ({ ...prev, image: url }));
      toast.success("Tải ảnh thành công");
    }
    e.target.value = "";
  };

  const clearImage = () => setForm((prev) => ({ ...prev, image: "" }));

  // --- DatePicker v5 renderer ---
  const renderDatePicker = (name, label) => (
    <DatePicker
      label={`${label} (dd/mm/yyyy)`}
      inputFormat={DMY}
      mask="__/__/____"
      value={isValidYmd(form[name]) ? dayjs(form[name], YMD, true) : null}
      onChange={(val) =>
        setForm((prev) => ({
          ...prev,
          [name]: val && dayjs(val).isValid() ? dayjs(val).format(YMD) : "",
        }))
      }
      renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
    />
  );

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
          <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                {renderDatePicker("regOpenDate", "Ngày mở đăng ký")}
                {renderDatePicker("registrationDeadline", "Hạn chót đăng ký")}
                {renderDatePicker("startDate", "Ngày thi đấu")}
                {renderDatePicker("endDate", "Ngày kết thúc")}

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

              <Grid item xs={12} md={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!form.noRankDelta}
                      onChange={(e) => setForm((p) => ({ ...p, noRankDelta: e.target.checked }))}
                    />
                  }
                  label="Không áp dụng điểm trình (toàn giải)"
                />
                <Typography variant="caption" color="text.secondary">
                  Mặc định toàn bộ trận trong giải này không cộng/trừ Δ (rating delta). Ở trang
                  Bracket có thể bật/tắt riêng từng Bracket (Bracket sẽ ưu tiên hơn).
                </Typography>
              </Grid>

              {/* ==== ReactQuill Editors (có nút chèn ảnh) ==== */}
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
                    ref={contactQuillRef}
                    theme="snow"
                    value={form.contactHtml}
                    onChange={(html) => setForm((p) => ({ ...p, contactHtml: html }))}
                    modules={contactModules} // ✅ đã memoized
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
                    ref={contentQuillRef}
                    theme="snow"
                    value={form.contentHtml}
                    onChange={(html) => setForm((p) => ({ ...p, contentHtml: html }))}
                    modules={contentModules} // ✅ đã memoized
                    formats={quillFormats}
                    placeholder="Mô tả chi tiết thể lệ, cơ cấu giải thưởng, lưu ý…"
                  />
                </Box>
              </Grid>
            </Grid>
          </LocalizationProvider>

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
