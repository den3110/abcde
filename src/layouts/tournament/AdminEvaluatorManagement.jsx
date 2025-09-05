/*
  Admin Evaluator Management (MUI) – v2
  -------------------------------------------------------
  Cập nhật theo yêu cầu:
  - Dialog "Thêm người chấm trình": chọn User bằng Autocomplete (có tìm kiếm – lấy từ useGetUsersQuery).
  - Chọn TỈNH: dùng Autocomplete multiple + checkbox + search (cả ở dialog Thêm và Sửa phạm vi).
  - Toolbar filter tỉnh: chuyển sang Autocomplete để tránh label đè chữ.
  - Giữ lại các API RTK đã wiring.
*/

/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  Grid,
  Card,
  IconButton,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Stack,
  Box,
  Pagination,
  Snackbar,
  Alert,
  InputLabel,
  FormControl,
  OutlinedInput,
  useMediaQuery,
  useTheme,
  Autocomplete,
  Checkbox,
  ListItemText,
} from "@mui/material";
import AddIcon from "@mui/icons-material/PersonAddAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import TuneIcon from "@mui/icons-material/Tune";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import SearchIcon from "@mui/icons-material/Search";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import {
  useGetEvaluatorsQuery,
  useUpdateEvaluatorScopesMutation,
  usePromoteToEvaluatorMutation,
  useDemoteEvaluatorMutation,
  useDeleteUserMutation,
  useUpdateUserInfoMutation,
  useGetUsersQuery, // ⬅️ lấy list user cho Autocomplete
} from "slices/adminApiSlice";

// Provinces (đồng nhất với hệ thống)
const PROVINCES = [
  "An Giang",
  "Bà Rịa-Vũng Tàu",
  "Bạc Liêu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Dương",
  "Bình Định",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cao Bằng",
  "Cần Thơ",
  "Đà Nẵng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Nội",
  "Hà Tĩnh",
  "Hải Dương",
  "Hải Phòng",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "TP Hồ Chí Minh",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
];

const SPORTS = ["pickleball"]; // hiện tại
const prettyDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");

function ChipsOverflow({ items = [], max = 3 }) {
  if (!items?.length) return <MDTypography variant="button">—</MDTypography>;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
      {shown.map((p) => (
        <Chip key={p} size="small" label={p} />
      ))}
      {rest > 0 && <Chip size="small" label={`+${rest}`} />}
    </Stack>
  );
}

export default function AdminEvaluatorManagement() {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  // filters
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");

  const { data, isFetching, refetch } = useGetEvaluatorsQuery({
    page: page + 1,
    keyword,
    province: provinceFilter || undefined,
    sport: sportFilter || undefined,
  });

  // mutations
  const [updateScopes] = useUpdateEvaluatorScopesMutation();
  const [promote] = usePromoteToEvaluatorMutation();
  const [demote] = useDemoteEvaluatorMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [updateInfo] = useUpdateUserInfoMutation();

  // dialogs
  const [dlgScope, setDlgScope] = useState(null); // { _id, name, provinces, sports }
  const [dlgEdit, setDlgEdit] = useState(null); // basic info
  const [dlgAdd, setDlgAdd] = useState(false); // promote/create
  const [dlgDemote, setDlgDemote] = useState(null); // user object
  const [dlgDelete, setDlgDelete] = useState(null); // user object

  // ADD dialog state
  const [addSelectedUser, setAddSelectedUser] = useState(null); // object từ Autocomplete
  const [addUserSearch, setAddUserSearch] = useState("");
  const [addProvinces, setAddProvinces] = useState([]);
  const [addSports, setAddSports] = useState(["pickleball"]);

  // fetch users for Autocomplete (debounce theo addUserSearch)
  const [kw, setKw] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setKw(addUserSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [addUserSearch]);

  const { data: userPickList, isFetching: fetchingUsers } = useGetUsersQuery(
    { page: 1, keyword: kw, role: "" },
    { skip: !dlgAdd } // chỉ gọi khi dialog Add mở
  );

  const userOptions = useMemo(() => userPickList?.users || [], [userPickList]);

  // snackbar
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // debounce main search (toolbar)
  const [search, setSearch] = useState(keyword);
  useEffect(() => {
    const t = setTimeout(() => setKeyword(search.trim()), 450);
    return () => clearTimeout(t);
  }, [search]);

  const handle = async (promise, successMsg) => {
    try {
      await promise;
      showSnack("success", successMsg);
      refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err?.error || "Đã xảy ra lỗi");
    }
  };

  const columns = useMemo(
    () => [
      { Header: "Tên", accessor: "name", align: "left" },
      { Header: "Email", accessor: "email", align: "left" },
      { Header: "Tỉnh được chấm", accessor: "provinces", align: "left", width: "24%" },
      { Header: "Môn", accessor: "sports", align: "center" },
      { Header: "Cập nhật", accessor: "updatedAt", align: "center" },
      { Header: "Thao tác", accessor: "act", align: "center", width: "18%" },
    ],
    []
  );

  const rows = useMemo(
    () =>
      data?.users?.map((u) => ({
        name: (
          <Stack>
            <MDTypography variant="button">{u.name}</MDTypography>
            <MDTypography variant="caption" color="text.secondary">
              {u.nickname || "—"}
            </MDTypography>
          </Stack>
        ),
        email: <MDTypography variant="button">{u.email}</MDTypography>,
        provinces: <ChipsOverflow items={u.gradingScopes?.provinces || []} />,
        sports: (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            {(u.gradingScopes?.sports || []).map((s) => (
              <Chip key={s} size="small" label={s} />
            ))}
          </Stack>
        ),
        updatedAt: <MDTypography variant="button">{prettyDate(u.updatedAt)}</MDTypography>,
        act: (
          <Stack direction="row" spacing={1} justifyContent="center">
            <Tooltip title="Sửa phạm vi chấm">
              <IconButton
                size="small"
                color="primary"
                onClick={() =>
                  setDlgScope({
                    _id: u._id,
                    name: u.name,
                    provinces: u.gradingScopes?.provinces || [],
                    sports: u.gradingScopes?.sports || [],
                  })
                }
              >
                <TuneIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Sửa thông tin">
              <IconButton size="small" onClick={() => setDlgEdit({ ...u })}>
                <EditIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Tắt quyền chấm">
              <IconButton size="small" onClick={() => setDlgDemote(u)}>
                <ArrowDropDownIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Xoá người dùng">
              <IconButton size="small" color="error" onClick={() => setDlgDelete(u)}>
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      })) || [],
    [data]
  );

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  // Helpers cho Autocomplete province (checkbox render)
  const renderProvinceOption = (props, option, { selected }) => (
    <li {...props}>
      <Checkbox style={{ marginRight: 8 }} checked={selected} />
      <ListItemText primary={option} />
    </li>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />

      {/* Toolbar */}
      <MDBox px={3} pt={4} pb={1.5}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm="auto">
            <TextField
              size="small"
              label="Tìm tên / email" // ⬅️ thêm label để không bị đè
              placeholder="Nhập từ khóa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> }}
              sx={{ width: { xs: "100%", sm: 320 } }}
            />
          </Grid>

          <Grid item xs={12} sm="auto" sx={{ minWidth: 260 }}>
            <Autocomplete
              options={["", ...PROVINCES]}
              value={provinceFilter}
              onChange={(_, v) => {
                setProvinceFilter(v || "");
                setPage(0);
              }}
              getOptionLabel={(opt) => (opt ? opt : "Tất cả")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Lọc theo tỉnh"
                  placeholder="Gõ để tìm tỉnh"
                  size="small"
                />
              )}
              clearOnEscape
            />
          </Grid>

          <Grid item xs={12} sm="auto">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="sport-filter">Môn</InputLabel>
              <Select
                labelId="sport-filter"
                label="Môn"
                value={sportFilter}
                onChange={(e) => {
                  setSportFilter(e.target.value);
                  setPage(0);
                }}
                displayEmpty
              >
                <MenuItem value="">
                  <em>Tất cả</em>
                </MenuItem>
                {SPORTS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs>
            {/* spacer */}
          </Grid>

          <Grid item xs={12} sm="auto">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlgAdd(true)}>
              Thêm người chấm trình
            </Button>
          </Grid>
        </Grid>
      </MDBox>

      {/* Table */}
      <MDBox pt={2} pb={3} px={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              {isFetching ? (
                <MDBox py={6} textAlign="center">
                  <CircularProgress />
                </MDBox>
              ) : (
                <>
                  <DataTable
                    table={{ columns, rows }}
                    isSorted={false}
                    entriesPerPage={false}
                    showTotalEntries={false}
                    noEndBorder
                    canSearch={false}
                  />
                  <MDBox py={2} display="flex" justifyContent="center">
                    <Pagination
                      page={page + 1}
                      count={totalPages}
                      color="primary"
                      onChange={(_, v) => setPage(v - 1)}
                    />
                  </MDBox>
                </>
              )}
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Footer />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Dialog: Edit scopes (provinces bằng Autocomplete multiple + checkbox) */}
      <Dialog open={!!dlgScope} onClose={() => setDlgScope(null)} maxWidth="sm" fullWidth>
        {dlgScope && (
          <>
            <DialogTitle>Phạm vi chấm – {dlgScope.name}</DialogTitle>
            <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Autocomplete
                multiple
                options={PROVINCES}
                value={dlgScope.provinces}
                onChange={(_, val) => setDlgScope((s) => ({ ...s, provinces: val }))}
                disableCloseOnSelect
                renderOption={renderProvinceOption}
                renderInput={(params) => (
                  <TextField {...params} label="Tỉnh được chấm" placeholder="Chọn tỉnh" />
                )}
              />

              <FormControl fullWidth>
                <InputLabel id="sports-label">Môn</InputLabel>
                <Select
                  labelId="sports-label"
                  label="Môn"
                  multiple
                  value={dlgScope.sports}
                  onChange={(e) => setDlgScope((s) => ({ ...s, sports: e.target.value }))}
                  input={<OutlinedInput label="Môn" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((v) => (
                        <Chip key={v} label={v} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {SPORTS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDlgScope(null)}>Huỷ</Button>
              <Button
                variant="contained"
                onClick={() =>
                  handle(
                    updateScopes({
                      id: dlgScope._id,
                      body: { provinces: dlgScope.provinces, sports: dlgScope.sports },
                    }).unwrap(),
                    "Đã cập nhật phạm vi chấm"
                  ).then(() => setDlgScope(null))
                }
              >
                Lưu
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog: Add evaluator – chọn User bằng Autocomplete, tỉnh bằng Autocomplete multiple */}
      <Dialog open={dlgAdd} onClose={() => setDlgAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Thêm người chấm trình</DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Autocomplete
            options={userOptions}
            value={addSelectedUser}
            onChange={(_, val) => setAddSelectedUser(val)}
            onInputChange={(_, v) => setAddUserSearch(v)}
            loading={fetchingUsers}
            getOptionLabel={(u) =>
              u ? `${u.name} (${u.email})${u.nickname ? ` • ${u.nickname}` : ""}` : ""
            }
            isOptionEqualToValue={(opt, val) => opt?._id === val?._id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Chọn người dùng"
                placeholder="Gõ tên hoặc email để tìm"
                InputProps={{
                  ...params.InputProps,
                }}
              />
            )}
          />

          <Autocomplete
            multiple
            options={PROVINCES}
            value={addProvinces}
            onChange={(_, val) => setAddProvinces(val)}
            disableCloseOnSelect
            renderOption={renderProvinceOption}
            renderInput={(params) => (
              <TextField {...params} label="Tỉnh được chấm" placeholder="Chọn tỉnh" />
            )}
          />

          <FormControl fullWidth>
            <InputLabel id="add-sports">Môn</InputLabel>
            <Select
              labelId="add-sports"
              label="Môn"
              multiple
              value={addSports}
              onChange={(e) => setAddSports(e.target.value)}
              input={<OutlinedInput label="Môn" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((v) => (
                    <Chip key={v} label={v} size="small" />
                  ))}
                </Box>
              )}
            >
              {SPORTS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgAdd(false)}>Huỷ</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() =>
              handle(
                promote({
                  idOrEmail: addSelectedUser?._id, // FE truyền _id
                  provinces: addProvinces,
                  sports: addSports,
                }).unwrap(),
                "Đã thêm người chấm trình"
              ).then(() => {
                setDlgAdd(false);
                setAddSelectedUser(null);
                setAddUserSearch("");
                setAddProvinces([]);
                setAddSports(["pickleball"]);
              })
            }
            disabled={!addSelectedUser || addProvinces.length === 0}
          >
            Thêm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit basic info (giữ nguyên) */}
      <Dialog open={!!dlgEdit} onClose={() => setDlgEdit(null)} maxWidth="sm" fullWidth>
        {dlgEdit && (
          <>
            <DialogTitle>Sửa thông tin – {dlgEdit.name}</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
              <TextField
                label="Tên"
                value={dlgEdit.name}
                onChange={(e) => setDlgEdit({ ...dlgEdit, name: e.target.value })}
              />
              <TextField
                label="Phone"
                value={dlgEdit.phone || ""}
                onChange={(e) => setDlgEdit({ ...dlgEdit, phone: e.target.value })}
              />
              <TextField
                label="Email"
                value={dlgEdit.email}
                onChange={(e) => setDlgEdit({ ...dlgEdit, email: e.target.value })}
              />
              <FormControl fullWidth size="small" sx={{ ".MuiInputBase-root": { height: 40 } }}>
                <InputLabel id="prov-lbl">Tỉnh / Thành (nơi ở)</InputLabel>
                <Select
                  labelId="prov-lbl"
                  label="Tỉnh / Thành (nơi ở)"
                  value={dlgEdit.province || ""}
                  onChange={(e) => setDlgEdit({ ...dlgEdit, province: e.target.value })}
                >
                  <MenuItem value="">
                    <em>-- Chọn --</em>
                  </MenuItem>
                  {PROVINCES.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDlgEdit(null)}>Huỷ</Button>
              <Button
                variant="contained"
                onClick={() =>
                  handle(
                    updateInfo({
                      id: dlgEdit._id,
                      body: {
                        name: dlgEdit.name,
                        phone: dlgEdit.phone,
                        email: dlgEdit.email,
                        province: dlgEdit.province,
                      },
                    }).unwrap(),
                    "Đã cập nhật người dùng"
                  ).then(() => setDlgEdit(null))
                }
              >
                Lưu
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog: Demote */}
      <Dialog open={!!dlgDemote} onClose={() => setDlgDemote(null)}>
        {dlgDemote && (
          <>
            <DialogTitle>Tắt quyền chấm của {dlgDemote.name}</DialogTitle>
            <DialogContent>
              Sau khi tắt, người này sẽ không thể chấm trình cho đến khi được bật lại. Bạn có chắc
              chắn?
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDlgDemote(null)}>Huỷ</Button>
              <Button
                color="warning"
                variant="contained"
                onClick={() =>
                  handle(
                    demote({ id: dlgDemote._id, body: { toRole: "user" } }).unwrap(),
                    "Đã tắt quyền chấm"
                  ).then(() => setDlgDemote(null))
                }
              >
                Hạ cấp
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog: Delete */}
      <Dialog open={!!dlgDelete} onClose={() => setDlgDelete(null)}>
        {dlgDelete && (
          <>
            <DialogTitle>Xoá {dlgDelete.name}?</DialogTitle>
            <DialogContent>Xoá vĩnh viễn người dùng này. Không thể hoàn tác.</DialogContent>
            <DialogActions>
              <Button onClick={() => setDlgDelete(null)}>Huỷ</Button>
              <Button
                color="error"
                variant="contained"
                onClick={() =>
                  handle(deleteUser(dlgDelete._id).unwrap(), "Đã xoá người dùng").then(() =>
                    setDlgDelete(null)
                  )
                }
              >
                Xoá
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </DashboardLayout>
  );
}
