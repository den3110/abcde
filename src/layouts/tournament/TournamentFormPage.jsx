import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import {
  useCreateTournamentMutation,
  useGetTournamentQuery,
  useUpdateTournamentMutation,
} from "../../slices/tournamentsApiSlice";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const sportTypes = [
  { value: 1, label: "Pickleball" },
  { value: 2, label: "Tennis" },
];

export default function TournamentFormPage() {
  const { id } = useParams(); // "new" | <id>
  const isEdit = id && id !== "new";

  const { data: tour } = useGetTournamentQuery(id, { skip: !isEdit });
  const [createTour] = useCreateTournamentMutation();
  const [updateTour] = useUpdateTournamentMutation();
  const nav = useNavigate();

  /* ---------- State ---------- */
  const today = dayjs().format("YYYY-MM-DD");
  const [form, setForm] = useState({
    name: "",
    image: "",
    sportType: 1,
    groupId: 0,
    eventType: "double",
    regOpenDate: today,
    registrationDeadline: today,
    startDate: today,
    endDate: today,
    scoreCap: 0,
    scoreGap: 0,
    singleCap: 0,
    location: "",
    contactHtml: "",
    contentHtml: "",
  });

  useEffect(() => {
    if (tour) {
      const clone = { ...tour };
      ["regOpenDate", "registrationDeadline", "startDate", "endDate"].forEach(
        (k) => (clone[k] = dayjs(clone[k]).format("YYYY-MM-DD"))
      );
      setForm(clone);
    }
  }, [tour]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  /* ---------- submit ---------- */
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateTour({ id, ...form }).unwrap();
        toast.success("Đã cập nhật");
      } else {
        await createTour(form).unwrap();
        toast.success("Đã tạo mới");
      }
      nav("/admin/tournaments");
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  /* ---------- UI ---------- */
  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box p={3}>
        <Typography variant="h4" mb={3}>
          {isEdit ? "Sửa giải đấu" : "Tạo giải đấu"}
        </Typography>

        <Box component="form" onSubmit={submit}>
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
              <TextField
                name="image"
                label="Ảnh URL"
                value={form.image}
                onChange={onChange}
                fullWidth
                margin="normal"
              />
              <TextField
                name="sportType"
                label="Môn"
                select
                value={form.sportType}
                onChange={onChange}
                fullWidth
                margin="normal"
              >
                {sportTypes.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
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
                  type="date"
                  name={d.n}
                  label={d.l}
                  value={form[d.n]}
                  onChange={onChange}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                />
              ))}

              {[
                { n: "scoreCap", l: "Tổng điểm tối đa cho đôi" },
                { n: "scoreGap", l: "Chênh lệch tối đa" },
                { n: "singleCap", l: "Điểm tối đa 1 VĐV" },
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

            <Grid item xs={12}>
              <TextField
                name="contactHtml"
                label="Thông tin liên hệ (HTML)"
                value={form.contactHtml}
                onChange={onChange}
                fullWidth
                multiline
                rows={3}
                margin="normal"
              />
              <TextField
                name="contentHtml"
                label="Nội dung giải (HTML)"
                value={form.contentHtml}
                onChange={onChange}
                fullWidth
                multiline
                rows={4}
                margin="normal"
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} mt={3}>
            <Button type="submit" variant="contained">
              {isEdit ? "Cập nhật" : "Tạo mới"}
            </Button>
            <Button variant="outlined" onClick={() => nav(-1)}>
              Huỷ
            </Button>
          </Stack>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
