/* eslint-disable react/prop-types */
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
  RadioGroup,
  Radio,
  Skeleton,
  InputAdornment,
  Slider,
} from "@mui/material";

// === MUI X Date Pickers v5 ===
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import PropTypes from "prop-types";
import {
  useCreateTournamentMutation,
  useGetTournamentQuery,
  useUpdateTournamentMutation,
  useUploadAvatarMutation,
} from "../../slices/tournamentsApiSlice";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";

dayjs.extend(customParseFormat);
dayjs.extend(utc);

/* ===== 63 tỉnh/thành Việt Nam ===== */
const VN_PROVINCES = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Hải Phòng",
  "Đà Nẵng",
  "Cần Thơ",
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Dương",
  "Bình Định",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cao Bằng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Tĩnh",
  "Hải Dương",
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
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
];

export const SEPAY_BANKS = [
  { value: "Vietcombank", label: "Vietcombank - Ngân hàng TMCP Ngoại Thương Việt Nam" },
  { value: "VietinBank", label: "VietinBank - Ngân hàng TMCP Công thương Việt Nam" },
  { value: "MBBank", label: "MBBank - Ngân hàng TMCP Quân đội" },
  { value: "ACB", label: "ACB - Ngân hàng TMCP Á Châu" },
  { value: "VPBank", label: "VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { value: "TPBank", label: "TPBank - Ngân hàng TMCP Tiên Phong" },
  { value: "MSB", label: "MSB - Ngân hàng TMCP Hàng Hải" },
  { value: "NamABank", label: "NamABank - Ngân hàng TMCP Nam Á" },
  { value: "LienVietPostBank", label: "LienVietPostBank - Ngân hàng TMCP Bưu Điện Liên Việt" },
  { value: "VietCapitalBank", label: "VietCapitalBank - Ngân hàng TMCP Bản Việt" },
  { value: "BIDV", label: "BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { value: "Sacombank", label: "Sacombank - Ngân hàng TMCP Sài Gòn Thương Tín" },
  { value: "VIB", label: "VIB - Ngân hàng TMCP Quốc tế Việt Nam" },
  { value: "HDBank", label: "HDBank - Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh" },
  { value: "SeABank", label: "SeABank - Ngân hàng TMCP Đông Nam Á" },
  { value: "GPBank", label: "GPBank - Ngân hàng TM TNHH MTV Dầu Khí Toàn Cầu" },
  { value: "PVcomBank", label: "PVcomBank - Ngân hàng TMCP Đại Chúng Việt Nam" },
  { value: "NCB", label: "NCB - Ngân hàng TMCP Quốc Dân" },
  { value: "ShinhanBank", label: "ShinhanBank - Ngân hàng TNHH MTV Shinhan Việt Nam" },
  { value: "SCB", label: "SCB - Ngân hàng TMCP Sài Gòn" },
  { value: "PGBank", label: "PGBank - Ngân hàng TMCP Xăng dầu Petrolimex" },
  { value: "Agribank", label: "Agribank - Ngân hàng Nông nghiệp và PTNT Việt Nam" },
  { value: "Techcombank", label: "Techcombank - Ngân hàng TMCP Kỹ thương Việt Nam" },
  { value: "SaigonBank", label: "SaigonBank - Ngân hàng TMCP Sài Gòn Công Thương" },
  { value: "DongABank", label: "DongABank - Ngân hàng TMCP Đông Á" },
  { value: "BacABank", label: "BacABank - Ngân hàng TMCP Bắc Á" },
  {
    value: "StandardChartered",
    label: "StandardChartered - NH TNHH MTV Standard Chartered Bank Việt Nam",
  },
  { value: "Oceanbank", label: "Oceanbank - Ngân hàng TM TNHH MTV Đại Dương" },
  { value: "VRB", label: "VRB - Ngân hàng Liên doanh Việt - Nga" },
  { value: "ABBANK", label: "ABBANK - Ngân hàng TMCP An Bình" },
  { value: "VietABank", label: "VietABank - Ngân hàng TMCP Việt Á" },
  { value: "Eximbank", label: "Eximbank - Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { value: "VietBank", label: "VietBank - Ngân hàng TMCP Việt Nam Thương Tín" },
  { value: "IndovinaBank", label: "IndovinaBank - Ngân hàng TNHH Indovina" },
  { value: "BaoVietBank", label: "BaoVietBank - Ngân hàng TMCP Bảo Việt" },
  { value: "PublicBank", label: "PublicBank - Ngân hàng TNHH MTV Public Việt Nam" },
  { value: "SHB", label: "SHB - Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { value: "CBBank", label: "CBBank - Ngân hàng TM TNHH MTV Xây dựng Việt Nam" },
  { value: "OCB", label: "OCB - Ngân hàng TMCP Phương Đông" },
  { value: "KienLongBank", label: "KienLongBank - Ngân hàng TMCP Kiên Long" },
  { value: "CIMB", label: "CIMB - Ngân hàng TNHH MTV CIMB Việt Nam" },
  { value: "HSBC", label: "HSBC - Ngân hàng TNHH MTV HSBC (Việt Nam)" },
  { value: "DBSBank", label: "DBSBank - DBS Bank Ltd - Chi nhánh TP.HCM" },
  { value: "Nonghyup", label: "Nonghyup - Ngân hàng Nonghyup - Chi nhánh Hà Nội" },
  { value: "HongLeong", label: "HongLeong - Ngân hàng TNHH MTV Hong Leong Việt Nam" },
  { value: "Woori", label: "Woori - Ngân hàng TNHH MTV Woori Việt Nam" },
  {
    value: "UnitedOverseas",
    label: "UnitedOverseas - Ngân hàng United Overseas - Chi nhánh TP.HCM",
  },
  { value: "KookminHN", label: "KookminHN - Ngân hàng Kookmin - Chi nhánh Hà Nội" },
  { value: "KookminHCM", label: "KookminHCM - Ngân hàng Kookmin - Chi nhánh TP.HCM" },
  { value: "COOPBANK", label: "COOPBANK - Ngân hàng Hợp tác xã Việt Nam" },
];

/* ===== Alias để search ngân hàng ===== */
const BANK_ALIASES = {
  Vietcombank: ["VCB", "ngoai thuong"],
  VietinBank: ["CTG", "cong thuong"],
  BIDV: ["BIDV", "dau tu phat trien"],
  Agribank: ["AGR", "nong nghiep"],
  Techcombank: ["TCB", "ky thuong"],
  MBBank: ["MBB", "MB", "quan doi"],
  ACB: ["ACB", "a chau"],
  VPBank: ["VPB", "viet nam thinh vuong", "vp bank"],
  Sacombank: ["STB", "sai gon thuong tin", "sacom"],
  TPBank: ["TPB", "tien phong"],
  VIB: ["VIB", "quoc te"],
  HDBank: ["HDB", "phat trien tphcm", "hd bank"],
  SHB: ["SHB", "sai gon ha noi"],
  Eximbank: ["EIB", "xuat nhap khau"],
  OCB: ["OCB", "phuong dong"],
  MSB: ["MSB", "hang hai"],
  SeABank: ["SSB", "dong nam a"],
  LienVietPostBank: ["LPB", "buu dien lien viet", "lienviet"],
  SCB: ["SCB", "sai gon"],
  PGBank: ["PGB", "xang dau petrolimex"],
  VietBank: ["viet bank", "vb"],
  BacABank: ["bac a", "bab"],
  GPBank: ["dau khi toan cau"],
  PVcomBank: ["pvcom", "dai chung"],
  VietCapitalBank: ["ban viet", "vccb", "viet capital"],
  SaigonBank: ["sai gon cong thuong"],
  DongABank: ["dong a"],
  BaoVietBank: ["baoviet"],
  PublicBank: ["public viet nam"],
  NCB: ["quoc dan"],
  ShinhanBank: ["shinhan"],
  StandardChartered: ["standard chartered", "sc"],
  Oceanbank: ["ocean"],
  VRB: ["viet nga", "vrb"],
  IndovinaBank: ["indovina", "ivb"],
  CBBank: ["xay dung"],
  KienLongBank: ["kien long", "klb"],
  CIMB: ["cimb"],
  HSBC: ["hsbc"],
  DBSBank: ["dbs"],
  Woori: ["woori"],
  HongLeong: ["hong leong"],
  UnitedOverseas: ["uob", "united overseas"],
  KookminHN: ["kookmin ha noi", "kb hn"],
  KookminHCM: ["kookmin hcm", "kb hcm"],
  COOPBANK: ["coopbank", "ngan hang hop tac"],
};

// helpers
const formatMoney = (s = "") => (s || "").replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const onlyDigits = (s = "") => (s || "").replace(/\D/g, "");
const normalizeVi = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BANKS_INDEX = SEPAY_BANKS.map((b) => {
  const aliases = BANK_ALIASES[b.value] || [];
  const hay = normalizeVi([b.value, b.label, ...aliases].join(" "));
  return { ...b, _hay: hay, _aliases: aliases.map(normalizeVi) };
});

const filterBankOptions = (options, { inputValue }) => {
  const q = normalizeVi(inputValue);
  if (!q) return options.slice(0, 50);
  const parts = q.split(/\s+/).filter(Boolean);

  return options
    .map((opt) => {
      const hay = opt._hay;
      let score = 0;
      const val = normalizeVi(opt.value);
      if (val === q) score += 120;
      if (val.startsWith(q)) score += 90;
      if (opt._aliases.includes(q)) score += 100;
      if (parts.every((p) => hay.includes(p))) score += 70;
      if (hay.startsWith(q)) score += 60;
      if (hay.includes(q)) score += 40;
      return { opt, score };
    })
    .filter((r) => r.score > 0 || q.length <= 1)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.opt)
    .slice(0, 30);
};

const MAX_IMG_SIZE = 10 * 1024 * 1024; // 10MB
const YMDHMS = "YYYY-MM-DDTHH:mm:ss";
const DMYHMS = "DD/MM/YYYY HH:mm:ss";
const isValidYmdHms = (s) => !!s && dayjs(s, YMDHMS, true).isValid();

const fixZToNaive = (s) => {
  if (!s) return "";
  // Nếu đã đúng dạng YYYY-MM-DDTHH:mm:ss thì giữ nguyên
  if (isValidYmdHms(s)) return s;

  // Parse ISO (có .000+07:00, hoặc Z, hoặc offset khác),
  // rồi format lại thành "YYYY-MM-DDTHH:mm:ss" theo local time
  const d = dayjs(s);
  return d.isValid() ? d.format(YMDHMS) : "";
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
};
const computeBirthYearRange = (startDT, minAge, maxAge) => {
  if (!isValidYmdHms(startDT)) return null;
  const year = dayjs(startDT, YMDHMS, true).year();
  if (!Number.isFinite(minAge) || !Number.isFinite(maxAge)) return null;
  return {
    minBirthYear: year - maxAge,
    maxBirthYear: year - minAge,
  };
};

/* ---------- Skeleton block cho UI khi đang load ---------- */
function FormSkeleton() {
  const Line = ({ w = "100%", h = 56, sx }) => (
    <Skeleton variant="rounded" width={w} height={h} sx={{ borderRadius: 1, ...sx }} />
  );
  Line.propTypes = {
    w: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    h: PropTypes.number,
    sx: PropTypes.any,
  };
  Line.defaultProps = { w: "100%", h: 56, sx: undefined };

  const Text = ({ w = 200, h = 36, sx }) => (
    <Skeleton variant="text" width={w} height={h} sx={sx} />
  );
  Text.propTypes = {
    w: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    h: PropTypes.number,
    sx: PropTypes.any,
  };
  Text.defaultProps = { w: 200, h: 36, sx: undefined };

  return (
    <Box p={3} sx={{ backgroundColor: "#fff", borderRadius: 1 }}>
      <Text w={260} h={44} sx={{ mb: 2 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Line />
          <Card variant="outlined" sx={{ p: 2, mt: 2, display: "grid", gap: 1 }}>
            <Text w={160} />
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Skeleton variant="rounded" width={160} height={90} sx={{ borderRadius: 1 }} />
              <Stack direction="row" spacing={1}>
                <Line w={120} h={40} />
                <Line w={100} h={40} />
              </Stack>
            </Box>
            <Line />
          </Card>
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Text w={140} />
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Line w={180} h={32} />
              <Line w={260} h={32} />
            </Stack>
            <Line sx={{ mt: 2 }} />
            <Text w={260} sx={{ mt: 1 }} />
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Line />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
          <Line sx={{ mt: 2 }} />
        </Grid>
        <Grid item xs={12}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={22} height={22} />
            <Text w={340} />
          </Stack>
          <Text w={420} />
        </Grid>
        <Grid item xs={12}>
          <Text w={160} />
          <Skeleton variant="rounded" height={190} sx={{ borderRadius: 1 }} />
        </Grid>
        <Grid item xs={12}>
          <Text w={160} />
          <Skeleton variant="rounded" height={240} sx={{ borderRadius: 1 }} />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} mt={3}>
        <Line w={140} h={40} />
        <Line w={100} h={40} />
      </Stack>
    </Box>
  );
}

export default function TournamentFormPage() {
  const { id } = useParams(); // "new" | <id>
  const isEdit = !!id && id !== "new";
  const { data: tour, isLoading, isFetching } = useGetTournamentQuery(id, { skip: !isEdit });

  const [createTour] = useCreateTournamentMutation();
  const [updateTour] = useUpdateTournamentMutation();
  const [uploadAvatar] = useUploadAvatarMutation();

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const now = dayjs();
  const nowStr = now.format(YMDHMS);
  const loading = isEdit && (!tour || isLoading || isFetching);

  const [form, setForm] = useState({
    name: "",
    image: "",
    sportType: 1,
    groupId: 0,
    eventType: "double",
    regOpenDT: nowStr,
    registrationDeadlineDT: nowStr,
    startDT: nowStr,
    endDT: nowStr,
    scoreCap: 0,
    scoreGap: 0,
    singleCap: 0,
    location: "",
    contactHtml: "",
    contentHtml: "",
    maxPairs: 0,
    noRankDelta: false,

    // phạm vi chấm
    scoringScopeType: "national",
    scoringProvinces: [],

    // ngân hàng
    bankShortName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    registrationFee: "",

    // điều kiện
    requireKyc: true,
    ageRestricted: false,
    ageMin: 0,
    ageMax: 100,
  });

  const [uploading, setUploading] = useState(false);

  const contactQuillRef = useRef(null);
  const contentQuillRef = useRef(null);

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

  const contactModules = useMemo(() => makeQuillModules(contactQuillRef), []); // eslint-disable-line
  const contentModules = useMemo(() => makeQuillModules(contentQuillRef), []); // eslint-disable-line

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

  useEffect(() => {
    if (!tour) return;

    let scopeType = "national";
    let scopeProvinces = [];
    if (tour.scoringScope?.type === "provinces" && Array.isArray(tour.scoringScope?.provinces)) {
      scopeType = "provinces";
      scopeProvinces = tour.scoringScope.provinces.filter(Boolean);
    } else if (tour.scoringScope?.type === "province" && tour.scoringScope?.province) {
      scopeType = "provinces";
      scopeProvinces = [tour.scoringScope.province];
    }

    const requireKyc =
      typeof tour.requireKyc === "boolean"
        ? tour.requireKyc
        : typeof tour.kycRequired === "boolean"
        ? tour.kycRequired
        : true;

    const ageEnabled = !!(tour.ageRestriction?.enabled ?? tour.ageRestricted ?? false);
    const ageMin = Number(tour.ageRestriction?.minAge ?? tour.ageMin ?? (ageEnabled ? 0 : 0));
    const ageMax = Number(tour.ageRestriction?.maxAge ?? tour.ageMax ?? (ageEnabled ? 100 : 100));

    const nextForm = {
      name: tour.name || "",
      image: tour.image || "",
      sportType: 1,
      groupId: Number(tour.groupId ?? 0),
      eventType: tour.eventType || "double",

      regOpenDT: fixZToNaive(tour.regOpenDate) || nowStr,
      registrationDeadlineDT: fixZToNaive(tour.registrationDeadline) || nowStr,
      startDT: fixZToNaive(tour.startDate) || nowStr,
      endDT: fixZToNaive(tour.endDate) || nowStr,

      scoreCap: Number(tour.scoreCap ?? 0),
      scoreGap: Number(tour.scoreGap ?? 0),
      singleCap: Number(tour.singleCap ?? 0),
      maxPairs: Number(tour.maxPairs ?? 0),
      location: tour.location || "",
      contactHtml: tour.contactHtml || "",
      contentHtml: tour.contentHtml || "",
      noRankDelta: !!tour.noRankDelta,

      scoringScopeType: scopeType,
      scoringProvinces: scopeProvinces,

      bankShortName: tour.bankShortName || tour.bankName || tour.paymentBank || "",
      bankAccountNumber: tour.bankAccountNumber || tour.accountNumber || tour.paymentAccount || "",
      registrationFee:
        tour.registrationFee != null && tour.registrationFee !== ""
          ? String(Number(tour.registrationFee))
          : "",
      bankAccountName:
        tour.bankAccountName ||
        tour.accountName ||
        tour.paymentAccountName ||
        tour.beneficiaryName ||
        "",

      requireKyc,
      ageRestricted: ageEnabled,
      ageMin: Number.isFinite(ageMin) ? ageMin : 0,
      ageMax: Number.isFinite(ageMax) ? ageMax : 100,
    };
    setForm(nextForm);
  }, [tour]); // eslint-disable-line

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onChangeBankAccountNumber = (e) => {
    const digitsOnly = (e.target.value || "").replace(/\D/g, "");
    setForm((prev) => ({ ...prev, bankAccountNumber: digitsOnly }));
  };
  const onChangeRegistrationFee = (e) => {
    const digits = onlyDigits(e.target.value);
    setForm((prev) => ({ ...prev, registrationFee: digits }));
  };

  const baseYear = useMemo(() => {
    return isValidYmdHms(form.startDT) ? dayjs(form.startDT, YMDHMS, true).year() : dayjs().year();
  }, [form.startDT]);

  const ageMarks = useMemo(
    () => [
      { value: 0, label: `0 tuổi` },
      { value: 100, label: `100 tuổi` },
    ],
    [baseYear]
  );

  const ageRange = useMemo(() => {
    let a = toInt(form.ageMin);
    let b = toInt(form.ageMax);
    if (!Number.isFinite(a)) a = 0;
    if (!Number.isFinite(b)) b = 100;
    a = Math.max(0, Math.min(100, a));
    b = Math.max(0, Math.min(100, b));
    if (a > b) [a, b] = [b, a];
    return [a, b];
  }, [form.ageMin, form.ageMax]);
  const ageBirthHint = useMemo(() => {
    const [a, b] = ageRange; // a = minAge, b = maxAge
    const fromYear = baseYear - b; // người lớn tuổi hơn -> năm sinh sớm hơn
    const toYear = baseYear - a;

    return `Năm sinh từ ${fromYear} (${b} tuổi) đến ${toYear} (${a} tuổi)${
      isValidYmdHms(form.startDT) ? ` ` : ""
    }`;
  }, [ageRange, baseYear, form.startDT]);

  const buildPayload = () => {
    const {
      scoringScopeType,
      scoringProvinces,
      regOpenDT,
      registrationDeadlineDT,
      startDT,
      endDT,
      ageRestricted,
    } = form;

    const [mn, mx] = ageRange;
    const yob = computeBirthYearRange(startDT, mn, mx);

    return {
      name: (form.name || "").trim(),
      image: form.image || "",
      sportType: 1,
      groupId: Number(form.groupId) || 0,
      eventType: form.eventType,

      regOpenDate: regOpenDT,
      registrationDeadline: registrationDeadlineDT,
      startDate: startDT,
      endDate: endDT,

      scoreCap: Number(form.scoreCap) || 0,
      scoreGap: Number(form.scoreGap) || 0,
      singleCap: Number(form.singleCap) || 0,
      location: form.location,
      contactHtml: form.contactHtml,
      contentHtml: form.contentHtml,
      maxPairs: Number(form.maxPairs) || 0,
      noRankDelta: !!form.noRankDelta,

      scoringScope: {
        type: scoringScopeType,
        provinces: scoringScopeType === "provinces" ? scoringProvinces : [],
      },

      bankShortName: form.bankShortName || "",
      bankAccountNumber: (form.bankAccountNumber || "").trim(),
      bankAccountName: (form.bankAccountName || "").trim(),
      registrationFee: Number(form.registrationFee) || 0,

      requireKyc: !!form.requireKyc,
      ageRestriction: {
        enabled: !!ageRestricted,
        minAge: mn,
        maxAge: mx,
        ...(yob ? { minBirthYear: yob.minBirthYear, maxBirthYear: yob.maxBirthYear } : {}),
      },

      // backward keys (nếu BE cũ còn đọc)
      ageRestricted: !!ageRestricted,
      ageMin: mn,
      ageMax: mx,
    };
  };

  const submit = async (e) => {
    e.preventDefault();

    const fields = [
      ["regOpenDT", "Ngày mở đăng ký"],
      ["registrationDeadlineDT", "Hạn chót đăng ký"],
      ["startDT", "Ngày thi đấu"],
      ["endDT", "Ngày kết thúc"],
    ];
    for (const [key, label] of fields) {
      if (!isValidYmdHms(form[key])) {
        toast.error(`Thời gian không hợp lệ ở: ${label}`);
        return;
      }
    }

    if (!SEPAY_BANKS.some((b) => b.value === form.bankShortName)) {
      toast.error("Vui lòng chọn ngân hàng hợp lệ.");
      return;
    }
    if (
      !/^\d*$/.test(form.bankAccountNumber) ||
      (form.bankAccountNumber && form.bankAccountNumber.length < 4)
    ) {
      toast.error("Số tài khoản chỉ gồm số và tối thiểu 4 chữ số.");
      return;
    }
    if ((form.bankShortName || form.bankAccountNumber) && !form.bankAccountName.trim()) {
      toast.error("Vui lòng nhập Tên chủ tài khoản.");
      return;
    }
    if (
      form.registrationFee !== "" &&
      (Number.isNaN(Number(form.registrationFee)) || Number(form.registrationFee) < 0)
    ) {
      toast.error("Phí đăng ký không hợp lệ (không được âm).");
      return;
    }
    if (form.scoringScopeType === "provinces") {
      const list = (form.scoringProvinces || []).filter(Boolean);
      if (!list.length) {
        toast.error("Vui lòng chọn ít nhất 1 tỉnh/thành.");
        return;
      }
      const invalid = list.find((p) => !VN_PROVINCES.includes(p));
      if (invalid) {
        toast.error(`Tỉnh/thành không hợp lệ: ${invalid}`);
        return;
      }
    }

    if (form.ageRestricted) {
      const [mn, mx] = ageRange;
      if (mn < 0 || mx < 0 || mn > 100 || mx > 100) {
        toast.error("Độ tuổi phải nằm trong khoảng 0–100.");
        return;
      }
      if (mn > mx) {
        toast.error("Tuổi tối thiểu không được lớn hơn tuổi tối đa.");
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

  const renderDateTime = (name, label) => (
    <DateTimePicker
      label={`${label} (dd/mm/yyyy hh:mm:ss)`}
      inputFormat={DMYHMS}
      mask="__/__/____ __:__:__"
      ampm={false}
      value={isValidYmdHms(form[name]) ? dayjs(form[name], YMDHMS, true) : null}
      onChange={(val) =>
        setForm((prev) => ({
          ...prev,
          [name]: val && dayjs(val).isValid() ? dayjs(val).format(YMDHMS) : "",
        }))
      }
      renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
      minutesStep={1}
      secondsStep={1}
    />
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      {loading ? (
        <FormSkeleton />
      ) : (
        <Box p={3} sx={{ backgroundColor: "#fff", borderRadius: 1 }}>
          <Typography variant="h4" mb={3}>
            {isEdit ? "Sửa Giải đấu" : "Tạo Giải đấu"}
          </Typography>

          <Box
            component="form"
            onSubmit={submit}
            noValidate
            aria-busy={uploading ? "true" : "false"}
            sx={{ "& .MuiInputBase-root": { minHeight: 50, alignItems: "center" } }}
          >
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Grid container spacing={3}>
                {/* Col trái */}
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
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

                  {/* Thông tin chuyển khoản */}
                  <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Thông tin chuyển khoản (SePay VietQR)
                    </Typography>
                    <Autocomplete
                      options={BANKS_INDEX}
                      value={BANKS_INDEX.find((o) => o.value === form.bankShortName) || null}
                      onChange={(_, val) =>
                        setForm((p) => ({ ...p, bankShortName: val?.value || "" }))
                      }
                      getOptionLabel={(o) => o?.label || o?.value || ""}
                      filterOptions={filterBankOptions}
                      isOptionEqualToValue={(o, v) => o.value === v.value}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Tên ngân hàng"
                          margin="normal"
                          fullWidth
                          helperText="Gõ 'VCB', 'CTG', 'TCB'… hoặc tên không dấu để tìm nhanh"
                          required
                        />
                      )}
                    />
                    <TextField
                      name="bankAccountNumber"
                      label="Số tài khoản"
                      fullWidth
                      margin="normal"
                      value={form.bankAccountNumber}
                      onChange={onChangeBankAccountNumber}
                      type="text"
                      inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 32 }}
                      helperText="Chỉ nhập số (0–9)."
                      required
                    />
                    <TextField
                      name="bankAccountName"
                      label="Tên chủ tài khoản"
                      fullWidth
                      margin="normal"
                      value={form.bankAccountName}
                      onChange={onChange}
                      onBlur={(e) =>
                        setForm((p) => ({
                          ...p,
                          bankAccountName: (e.target.value || "").replace(/\s+/g, " ").trim(),
                        }))
                      }
                      inputProps={{ maxLength: 64 }}
                      helperText="Tên người/đơn vị nhận tiền (có dấu hoặc không dấu đều được)"
                      required
                    />
                    <TextField
                      name="registrationFee"
                      label="Phí đăng ký (VND)"
                      fullWidth
                      margin="normal"
                      value={formatMoney(form.registrationFee)}
                      onChange={onChangeRegistrationFee}
                      type="text"
                      inputProps={{ inputMode: "numeric" }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">VND</InputAdornment>,
                      }}
                      helperText="Nhập số tiền, tự động thêm dấu phẩy ngăn cách"
                    />
                  </Card>

                  {/* Phạm vi giải đấu */}
                  <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Phạm vi giải đấu
                    </Typography>
                    <RadioGroup
                      row
                      value={form.scoringScopeType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          scoringScopeType: e.target.value,
                          scoringProvinces: e.target.value === "national" ? [] : p.scoringProvinces,
                        }))
                      }
                    >
                      <FormControlLabel value="national" control={<Radio />} label="Toàn quốc" />
                      <FormControlLabel
                        value="provinces"
                        control={<Radio />}
                        label="Giới hạn theo tỉnh (nhiều)"
                      />
                    </RadioGroup>

                    {form.scoringScopeType === "provinces" && (
                      <Autocomplete
                        multiple
                        options={VN_PROVINCES}
                        value={form.scoringProvinces}
                        onChange={(_, list) =>
                          setForm((p) => ({ ...p, scoringProvinces: list || [] }))
                        }
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              variant="outlined"
                              label={option}
                              {...getTagProps({ index })}
                              key={`${option}-${index}`}
                            />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Chọn tỉnh/thành"
                            margin="normal"
                            fullWidth
                          />
                        )}
                        disableCloseOnSelect
                        limitTags={3}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Toàn quốc: không giới hạn tỉnh. Giới hạn theo tỉnh: chỉ cho phép VĐV thuộc các
                      tỉnh đã chọn được tính điểm/đủ điều kiện.
                    </Typography>
                  </Card>

                  {/* Điều kiện tham gia */}
                  <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Điều kiện tham gia
                    </Typography>

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!form.requireKyc}
                          onChange={(e) => setForm((p) => ({ ...p, requireKyc: e.target.checked }))}
                        />
                      }
                      label="Yêu cầu KYC khi đăng ký"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!form.ageRestricted}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              ageRestricted: e.target.checked,
                              ...(e.target.checked ? { ageMin: 0, ageMax: 100 } : {}),
                            }))
                          }
                        />
                      }
                      label="Giới hạn độ tuổi"
                    />

                    {form.ageRestricted && (
                      <Box sx={{ mt: 1, overflow: "visible" }}>
                        <Slider
                          value={ageRange}
                          onChange={(_, v) =>
                            setForm((p) => ({ ...p, ageMin: v[0], ageMax: v[1] }))
                          }
                          min={0}
                          max={100}
                          step={1}
                          marks={ageMarks}
                          disableSwap
                          valueLabelDisplay="auto"
                          valueLabelFormat={(v) => `${v} tuổi`}
                          sx={{
                            mx: 1,
                            // Nhãn bubble (value label) gọn & không xuống dòng
                            "& .MuiSlider-valueLabel": {
                              whiteSpace: "nowrap",
                              fontSize: 12,
                              lineHeight: 1.2,
                              px: 1,
                              py: 0.5,
                            },
                            // Nhãn mốc (marks) không tràn và thu nhỏ chữ
                            "& .MuiSlider-markLabel": {
                              whiteSpace: "nowrap",
                              fontSize: 12,
                            },
                            // Căn 2 nhãn đầu/cuối vào trong để không “thò” ra mép
                            "& .MuiSlider-markLabel:first-of-type": {
                              transform: "translateX(0%)",
                            },
                            "& .MuiSlider-markLabel:last-of-type": {
                              transform: "translateX(-100%)",
                            },
                          }}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5, display: "block" }}
                        >
                          {ageBirthHint} {/* vẫn hiển thị dải năm sinh đầy đủ bên dưới */}
                        </Typography>
                      </Box>
                    )}
                  </Card>
                </Grid>

                {/* Col phải */}
                <Grid item xs={12} md={6}>
                  {renderDateTime("regOpenDT", "Ngày mở đăng ký")}
                  {renderDateTime("registrationDeadlineDT", "Hạn chót đăng ký")}
                  {renderDateTime("startDT", "Ngày thi đấu")}
                  {renderDateTime("endDT", "Ngày kết thúc")}

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

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!form.noRankDelta}
                        onChange={(e) => setForm((p) => ({ ...p, noRankDelta: e.target.checked }))}
                      />
                    }
                    label="Không áp dụng điểm trình (toàn giải)"
                  />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Mặc định toàn bộ trận trong giải này không cộng/trừ Δ (rating delta). Ở trang
                    Bracket có thể bật/tắt riêng từng Bracket (Bracket sẽ ưu tiên hơn).
                  </Typography>
                </Grid>

                {/* Editors */}
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
                      modules={contactModules}
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
                      modules={contentModules}
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
      )}
    </DashboardLayout>
  );
}
