/* eslint-disable react/prop-types */
// layouts/finance/FinancePage.jsx — Thu/chi giải đấu -> tính lợi nhuận (admin)
import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  Stack,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

import {
  useGetFinanceEntriesQuery,
  useGetFinanceSummaryQuery,
  useCreateFinanceEntryMutation,
  useDeleteFinanceEntryMutation,
} from "slices/financeApiSlice";

const fmtVND = (n) => `${Number(n || 0).toLocaleString("vi-VN")} ₫`;
const REVENUE_CATS = ["Vé", "Tài trợ", "Đăng ký", "Bán đồ", "Khác"];
const EXPENSE_CATS = [
  "Thuê sân",
  "Giải thưởng",
  "Nhân sự",
  "Thiết bị",
  "Marketing",
  "Ăn uống",
  "Khác",
];
const todayStr = () => new Date().toISOString().slice(0, 10);

function StatCard({ label, value, color }) {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={900} sx={{ color, mt: 0.5 }}>
        {fmtVND(value)}
      </Typography>
    </Card>
  );
}

export default function FinancePage() {
  // Bộ lọc chung (áp cho cả summary + bảng)
  const [filters, setFilters] = useState({ from: "", to: "", tournamentName: "", type: "" });
  const applyFilters = useMemo(() => {
    const f = {};
    if (filters.from) f.from = filters.from;
    if (filters.to) f.to = filters.to;
    if (filters.tournamentName.trim()) f.tournamentName = filters.tournamentName.trim();
    if (filters.type) f.type = filters.type;
    return f;
  }, [filters]);

  const { data: summary, isFetching: sumLoading } = useGetFinanceSummaryQuery(applyFilters);
  const { data: list, isFetching: listLoading } = useGetFinanceEntriesQuery({
    ...applyFilters,
    limit: 100,
  });
  const [createEntry, { isLoading: creating }] = useCreateFinanceEntryMutation();
  const [deleteEntry] = useDeleteFinanceEntryMutation();

  // Form thêm bút toán
  const [form, setForm] = useState({
    type: "revenue",
    amount: "",
    category: "",
    tournamentName: "",
    occurredAt: todayStr(),
    note: "",
  });
  const setF = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const onAdd = async () => {
    const amt = Number(String(form.amount).replace(/[^\d]/g, ""));
    if (!amt || amt <= 0) {
      toast.info("Nhập số tiền hợp lệ.");
      return;
    }
    try {
      await createEntry({
        type: form.type,
        amount: amt,
        category: form.category.trim(),
        tournamentName: form.tournamentName.trim(),
        occurredAt: form.occurredAt,
        note: form.note.trim(),
      }).unwrap();
      toast.success("Đã thêm bút toán");
      setForm((s) => ({ ...s, amount: "", note: "" }));
    } catch (err) {
      toast.error(err?.data?.message || "Thêm thất bại");
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Xoá bút toán này?")) return;
    try {
      await deleteEntry(id).unwrap();
      toast.success("Đã xoá");
    } catch (err) {
      toast.error(err?.data?.message || "Xoá thất bại");
    }
  };

  const totals = summary?.totals || { revenue: 0, expense: 0, profit: 0 };
  const cats = form.type === "revenue" ? REVENUE_CATS : EXPENSE_CATS;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
          Thu / Chi & Lợi nhuận
        </Typography>

        {/* Bộ lọc */}
        <Card sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={6} md={2}>
              <TextField
                label="Từ ngày"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={filters.from}
                onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                label="Đến ngày"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={filters.to}
                onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Lọc theo giải (tên)"
                size="small"
                fullWidth
                placeholder="VD: Heineken Pickleball World Cup 2026"
                value={filters.tournamentName}
                onChange={(e) =>
                  setFilters((s) => ({ ...s, tournamentName: e.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Loại"
                size="small"
                fullWidth
                value={filters.type}
                onChange={(e) => setFilters((s) => ({ ...s, type: e.target.value }))}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="revenue">Doanh thu</MenuItem>
                <MenuItem value="expense">Chi phí</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="text"
                onClick={() =>
                  setFilters({ from: "", to: "", tournamentName: "", type: "" })
                }
              >
                Xoá lọc
              </Button>
            </Grid>
          </Grid>
        </Card>

        {/* Thẻ tổng */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <StatCard label="TỔNG DOANH THU" value={totals.revenue} color="#16a34a" />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard label="TỔNG CHI PHÍ" value={totals.expense} color="#dc2626" />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              label="LỢI NHUẬN"
              value={totals.profit}
              color={totals.profit >= 0 ? "#2563EB" : "#dc2626"}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Form thêm + bảng */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                Thêm bút toán
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={form.type}
                onChange={(e, v) =>
                  v && setForm((s) => ({ ...s, type: v, category: "" }))
                }
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="revenue" color="success">
                  + Doanh thu
                </ToggleButton>
                <ToggleButton value="expense" color="error">
                  − Chi phí
                </ToggleButton>
              </ToggleButtonGroup>

              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Số tiền (VND)"
                    size="small"
                    fullWidth
                    value={form.amount}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        amount: e.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                    helperText={form.amount ? fmtVND(form.amount) : " "}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Hạng mục"
                    size="small"
                    fullWidth
                    value={form.category}
                    onChange={setF("category")}
                  >
                    <MenuItem value="">(Không phân loại)</MenuItem>
                    {cats.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Giải đấu (tên)"
                    size="small"
                    fullWidth
                    placeholder="Để trống nếu khoản chung"
                    value={form.tournamentName}
                    onChange={setF("tournamentName")}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Ngày"
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={form.occurredAt}
                    onChange={setF("occurredAt")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Ghi chú"
                    size="small"
                    fullWidth
                    value={form.note}
                    onChange={setF("note")}
                  />
                </Grid>
              </Grid>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAdd}
                disabled={creating}
                sx={{ mt: 1.5 }}
              >
                {creating ? "Đang lưu…" : "Thêm"}
              </Button>
            </Card>

            <Card sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                  Danh sách bút toán
                </Typography>
                {(listLoading || sumLoading) && <CircularProgress size={16} />}
                <Chip
                  size="small"
                  label={`${list?.total || 0} mục`}
                  sx={{ ml: "auto" }}
                />
              </Stack>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Ngày</TableCell>
                      <TableCell>Loại</TableCell>
                      <TableCell align="right">Số tiền</TableCell>
                      <TableCell>Hạng mục</TableCell>
                      <TableCell>Giải / Ghi chú</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(list?.items || []).map((it) => (
                      <TableRow key={it._id} hover>
                        <TableCell>
                          {new Date(it.occurredAt).toLocaleDateString("vi-VN")}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={it.type === "revenue" ? "Thu" : "Chi"}
                            sx={{
                              bgcolor:
                                it.type === "revenue" ? "#dcfce7" : "#fee2e2",
                              color: it.type === "revenue" ? "#166534" : "#991b1b",
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 800,
                            color: it.type === "revenue" ? "#16a34a" : "#dc2626",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {it.type === "revenue" ? "+" : "−"}
                          {fmtVND(it.amount)}
                        </TableCell>
                        <TableCell>{it.category || "—"}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {it.tournamentName || "(Chung)"}
                          </Typography>
                          {it.note ? (
                            <Typography variant="caption" color="text.secondary">
                              {it.note}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => onDelete(it._id)}>
                            <DeleteOutlineIcon fontSize="small" color="error" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!list?.items || list.items.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          Chưa có bút toán nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Card>
          </Grid>

          {/* Lợi nhuận theo giải + hạng mục */}
          <Grid item xs={12} md={5}>
            <Card sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                Lợi nhuận theo giải
              </Typography>
              <Stack spacing={1}>
                {(summary?.tournaments || []).map((t) => (
                  <Box key={t.name}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: "60%" }}>
                        {t.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{ color: t.profit >= 0 ? "#16a34a" : "#dc2626" }}
                      >
                        {fmtVND(t.profit)}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Thu {fmtVND(t.revenue)} · Chi {fmtVND(t.expense)}
                    </Typography>
                    <Divider sx={{ mt: 0.75 }} />
                  </Box>
                ))}
                {(!summary?.tournaments || summary.tournaments.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có dữ liệu.
                  </Typography>
                )}
              </Stack>
            </Card>

            <Card sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                Theo hạng mục
              </Typography>
              <Stack spacing={0.75}>
                {(summary?.categories || []).map((c) => (
                  <Stack key={c.name} direction="row" justifyContent="space-between">
                    <Typography variant="body2" noWrap sx={{ maxWidth: "55%" }}>
                      {c.name}
                    </Typography>
                    <Typography variant="body2">
                      {c.revenue ? (
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>
                          +{fmtVND(c.revenue)}{" "}
                        </span>
                      ) : null}
                      {c.expense ? (
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>
                          −{fmtVND(c.expense)}
                        </span>
                      ) : null}
                    </Typography>
                  </Stack>
                ))}
                {(!summary?.categories || summary.categories.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có dữ liệu.
                  </Typography>
                )}
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}
