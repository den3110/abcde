/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RefreshIcon from "@mui/icons-material/Refresh";
import SecurityIcon from "@mui/icons-material/Security";
import TimelineIcon from "@mui/icons-material/Timeline";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import { useVerifyQuery } from "slices/authApiSlice";
import {
  useExplainIdentitySecurityUserMutation,
  useGetIdentitySecurityOverviewQuery,
  useGetIdentitySecuritySettingsQuery,
  useGetIdentitySecurityUserQuery,
  useUpdateIdentitySecuritySettingsMutation,
} from "slices/identitySecurityApiSlice";
import { isStrictSuperAdminUser } from "utils/authz";

const ruleLabels = {
  newIp: "IP mới",
  newDevice: "Thiết bị mới",
  failureBurst: "Nhiều lần thất bại",
  failedThenSuccess: "Thất bại rồi đăng nhập thành công",
  offHour: "Khung giờ bất thường",
  sharedAccounts: "Nhiều tài khoản chung tín hiệu",
  deviceChanges: "Đổi thiết bị nhiều lần",
};

const trustColor = (level) => {
  if (level === "high_risk") return "error";
  if (level === "watch") return "warning";
  if (level === "high_trust") return "success";
  return "primary";
};

const severityColor = (severity) => {
  if (severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "default";
};

const fmtDate = (value) => {
  if (!value) return "Không có";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "Không có";
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getPathValue = (target, path, fallback = "") =>
  path.split(".").reduce((acc, key) => acc?.[key], target) ?? fallback;

const setPathValue = (target, path, value) => {
  const keys = path.split(".");
  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  return target;
};

function MetricCard({ label, value, caption, icon }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ mt: 0.25 }}>{icon}</Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function AccountList({ accounts, selectedUserId, onSelect }) {
  if (!accounts?.length) {
    return <Alert severity="info">Chưa có dữ liệu đăng nhập trong cửa sổ hiện tại.</Alert>;
  }

  return (
    <Stack spacing={1}>
      {accounts.map((account) => {
        const selected = selectedUserId === account.user?._id;
        return (
          <Paper
            key={account.user?._id}
            variant="outlined"
            onClick={() => onSelect(account.user?._id)}
            sx={{
              p: 1.25,
              cursor: "pointer",
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: selected ? "action.selected" : "background.paper",
              borderRadius: 2,
            }}
          >
            <Stack spacing={0.75}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={800} noWrap>
                    {account.user?.name || account.user?.nickname || account.user?.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {account.user?.email} | {account.user?.phone}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={trustColor(account.trust?.level)}
                  label={`${account.trust?.score ?? 0}/100`}
                />
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={account.trust?.level || "unknown"} variant="outlined" />
                <Chip
                  size="small"
                  label={`${account.baseline?.totals?.failedLast24h || 0} fail/24h`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`${account.graphSummary?.relatedAccounts || 0} liên quan`}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

function TrustPanel({ detail }) {
  const trust = detail?.trust || {};
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <SectionTitle
            icon={<SecurityIcon color="primary" />}
            title="Trust Score Per Account"
            subtitle="Điểm do rule engine tính; AI chỉ giải thích khi được gọi."
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Typography variant="h3" sx={{ fontWeight: 900 }}>
              {trust.score ?? 0}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 160 }}>
              <LinearProgress
                variant="determinate"
                value={trust.score || 0}
                color={trustColor(trust.level)}
                sx={{ height: 10, borderRadius: 999 }}
              />
              <Typography variant="caption" color="text.secondary">
                Action: {trust.recommendedAction || "allow"}
              </Typography>
            </Box>
            <Chip color={trustColor(trust.level)} label={trust.level || "unknown"} />
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Tín hiệu tốt
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {(trust.positive || []).map((item) => (
                  <Chip key={item} size="small" color="success" variant="outlined" label={item} />
                ))}
                {!trust.positive?.length ? <Chip size="small" label="Chưa có" /> : null}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Tín hiệu rủi ro
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {(trust.negative || []).map((item) => (
                  <Chip key={item} size="small" color="warning" variant="outlined" label={item} />
                ))}
                {!trust.negative?.length ? <Chip size="small" label="Không có rủi ro nổi bật" /> : null}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ExplainablePanel({ detail, explanation, onExplain, explaining }) {
  const explainable = detail?.explainableUx || {};
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <SectionTitle
              icon={<PsychologyIcon color="primary" />}
              title="Explainable Security UX"
              subtitle="Admin thấy lý do; user nhận thông điệp không lộ rule."
            />
            <Button
              variant="contained"
              startIcon={explaining ? <CircularProgress size={16} color="inherit" /> : <PsychologyIcon />}
              onClick={onExplain}
              disabled={explaining}
            >
              Tạo giải thích AI
            </Button>
          </Stack>
          <Alert severity={detail?.trust?.recommendedAction === "challenge" ? "warning" : "info"}>
            {explainable.userMessage}
          </Alert>
          <Stack spacing={0.75}>
            {(explainable.adminSummary || []).map((line) => (
              <Typography key={line} variant="body2" color="text.secondary">
                {line}
              </Typography>
            ))}
          </Stack>
          {explanation ? (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={explanation.source || "ai"}
                    color={explanation.source === "ai" ? "success" : "default"}
                  />
                  <Chip
                    size="small"
                    label={`confidence: ${explanation.confidence || "n/a"}`}
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {explanation.summary}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {(explanation.recommendedActions || []).map((item) => (
                    <Chip key={item} size="small" label={item} variant="outlined" />
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function BaselinePanel({ detail }) {
  const baseline = detail?.baseline || {};
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <SectionTitle
            icon={<TimelineIcon color="primary" />}
            title="Behavioral Baseline"
            subtitle="Dựng từ auth events và session history."
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${baseline.totals?.events || 0} events`} />
            <Chip label={`${baseline.totals?.uniqueIps || 0} IP groups`} variant="outlined" />
            <Chip label={`${baseline.totals?.uniqueDevices || 0} devices`} variant="outlined" />
            <Chip
              label={`${baseline.totals?.failedLast24h || 0} fail/24h`}
              color="warning"
              variant="outlined"
            />
          </Stack>
          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Bất thường
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(baseline.anomalies || []).map((item) => (
              <Chip key={item.code} size="small" color={severityColor(item.severity)} label={item.label} />
            ))}
            {!baseline.anomalies?.length ? <Chip size="small" label="Không phát hiện" /> : null}
          </Stack>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Khung giờ quen thuộc
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(baseline.usualHours || []).map((hour) => (
              <Chip key={hour} size="small" variant="outlined" label={`${hour}:00`} />
            ))}
            {!baseline.usualHours?.length ? <Chip size="small" label="Chưa đủ dữ liệu" /> : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function GraphPanel({ detail }) {
  const graph = detail?.graph || {};
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <SectionTitle
            icon={<AccountTreeIcon color="primary" />}
            title="Identity Graph"
            subtitle="User, email, phone, IP groups, thiết bị và account liên quan."
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${graph.summary?.nodes || 0} nodes`} />
            <Chip label={`${graph.summary?.edges || 0} edges`} variant="outlined" />
            <Chip label={`${graph.summary?.relatedAccounts || 0} account liên quan`} variant="outlined" />
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Nodes
              </Typography>
              <Stack spacing={0.75}>
                {(graph.nodes || []).slice(0, 14).map((node) => (
                  <Paper key={node.id} variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} justifyContent="space-between">
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                        {node.label}
                      </Typography>
                      <Chip size="small" label={node.type} />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Edges
              </Typography>
              <Stack spacing={0.75}>
                {(graph.edges || []).slice(0, 14).map((edge) => (
                  <Paper
                    key={`${edge.source}:${edge.target}:${edge.type}`}
                    variant="outlined"
                    sx={{ p: 1, borderRadius: 2 }}
                  >
                    <Stack direction="row" spacing={1} justifyContent="space-between">
                      <Typography variant="body2" noWrap>
                        {edge.type}
                      </Typography>
                      <Chip size="small" label={`x${edge.weight || 1}`} variant="outlined" />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SessionPanel({ detail }) {
  const sessions = detail?.sessions || {};
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <SectionTitle
            icon={<TravelExploreIcon color="primary" />}
            title="Session Forensics"
            subtitle="Timeline phiên đăng nhập từ login history và auth log."
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${sessions.summary?.sessions || 0} sessions`} />
            <Chip label={`${sessions.summary?.deviceChanges || 0} devices`} variant="outlined" />
            <Chip label={`${sessions.summary?.ipChanges || 0} IP groups`} variant="outlined" />
            <Chip
              label={`${sessions.summary?.failedSessions || 0} failed`}
              color="warning"
              variant="outlined"
            />
          </Stack>
          <Stack spacing={1}>
            {(sessions.sessions || []).slice(0, 8).map((session) => (
              <Paper key={session.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack spacing={0.75}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {session.device}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(session.at)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={session.success ? "success" : "failed"}
                      color={session.success ? "success" : "warning"}
                    />
                    <Chip size="small" label={session.ipMasked} variant="outlined" />
                    <Chip size="small" label={session.method || "password"} variant="outlined" />
                    {(session.flags || []).map((flag) => (
                      <Chip key={flag} size="small" label={flag} variant="outlined" />
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function NumberSetting({ label, value, onChange, min = 0, max = 999 }) {
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value ?? 0}
      onChange={(event) => onChange(toNumber(event.target.value))}
      inputProps={{ min, max }}
      sx={{ minWidth: 150 }}
    />
  );
}

function SettingsPanel({ settingsResponse, onSave, saving }) {
  const [draft, setDraft] = useState(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (settingsResponse?.settings) {
      setDraft(JSON.parse(JSON.stringify(settingsResponse.settings)));
    }
  }, [settingsResponse]);

  const setValue = (path, value) => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current || {}));
      return setPathValue(next, path, value);
    });
  };

  const handleResetDefaults = () => {
    if (!settingsResponse?.defaults) return;
    setDraft(JSON.parse(JSON.stringify(settingsResponse.defaults)));
    setSavedMessage("");
    setErrorMessage("");
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      await onSave(draft);
      setErrorMessage("");
      setSavedMessage("Đã lưu cấu hình Identity Security.");
    } catch (error) {
      setSavedMessage("");
      setErrorMessage(error?.data?.message || "Không lưu được cấu hình Identity Security.");
    }
  };

  if (!draft) {
    return (
      <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
        <CircularProgress />
      </Card>
    );
  }

  return (
    <Stack spacing={3}>
      {savedMessage ? <Alert severity="success">{savedMessage}</Alert> : null}
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<SecurityIcon color="primary" />}
              title="Cấu hình chung"
              subtitle="Áp dụng cho overview, trust engine và AI explanation."
            />
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(draft.enabled)}
                    onChange={(event) => setValue("enabled", event.target.checked)}
                  />
                }
                label="Bật Identity Security"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(draft.ai?.enabled)}
                    onChange={(event) => setValue("ai.enabled", event.target.checked)}
                  />
                }
                label="Bật AI explanation"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.ai?.fallbackEnabled !== false}
                    onChange={(event) => setValue("ai.fallbackEnabled", event.target.checked)}
                  />
                }
                label="Fallback khi AI lỗi"
              />
            </Stack>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <NumberSetting
                label="Window mặc định"
                value={draft.analysis?.defaultWindowDays}
                min={1}
                max={180}
                onChange={(value) => setValue("analysis.defaultWindowDays", value)}
              />
              <NumberSetting
                label="Số account overview"
                value={draft.analysis?.overviewLimit}
                min={3}
                max={30}
                onChange={(value) => setValue("analysis.overviewLimit", value)}
              />
              <NumberSetting
                label="Event limit"
                value={draft.analysis?.eventLimit}
                min={20}
                max={240}
                onChange={(value) => setValue("analysis.eventLimit", value)}
              />
              <TextField
                size="small"
                label="Model AI"
                value={draft.ai?.model || ""}
                placeholder="Dùng mặc định nếu để trống"
                onChange={(event) => setValue("ai.model", event.target.value)}
                sx={{ minWidth: 260 }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<TimelineIcon color="primary" />}
              title="Rule engine"
              subtitle="Threshold và penalty ảnh hưởng trực tiếp đến trust score."
            />
            <Stack spacing={1.25}>
              {Object.entries(draft.rules || {}).map(([key, rule]) => (
                <Paper key={key} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack
                    direction={{ xs: "column", lg: "row" }}
                    spacing={1.25}
                    alignItems={{ lg: "center" }}
                  >
                    <Box sx={{ minWidth: 260, flex: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(rule.enabled)}
                            onChange={(event) =>
                              setValue(`rules.${key}.enabled`, event.target.checked)
                            }
                          />
                        }
                        label={ruleLabels[key] || key}
                      />
                    </Box>
                    <Select
                      size="small"
                      value={rule.severity || "medium"}
                      onChange={(event) => setValue(`rules.${key}.severity`, event.target.value)}
                      sx={{ minWidth: 130 }}
                    >
                      <MenuItem value="low">low</MenuItem>
                      <MenuItem value="medium">medium</MenuItem>
                      <MenuItem value="high">high</MenuItem>
                    </Select>
                    <NumberSetting
                      label="Threshold"
                      value={rule.threshold}
                      min={0}
                      max={100}
                      onChange={(value) => setValue(`rules.${key}.threshold`, value)}
                    />
                    <NumberSetting
                      label="Window phút"
                      value={rule.windowMinutes}
                      min={0}
                      max={1440}
                      onChange={(value) => setValue(`rules.${key}.windowMinutes`, value)}
                    />
                    <NumberSetting
                      label="Penalty"
                      value={rule.penalty}
                      min={0}
                      max={100}
                      onChange={(value) => setValue(`rules.${key}.penalty`, value)}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<PsychologyIcon color="primary" />}
              title="Trust score"
              subtitle="Cấu hình điểm nền, ngưỡng phân loại và bonus/penalty."
            />
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {[
                ["trust.baseScore", "Base score", 0, 100],
                ["trust.highTrustMin", "High trust từ", 0, 100],
                ["trust.normalMin", "Normal từ", 0, 100],
                ["trust.watchMin", "Watch từ", 0, 100],
                ["trust.matureAccountDays", "Account mature ngày", 0, 2000],
                ["trust.newAccountDays", "Account mới ngày", 0, 365],
                ["trust.matureAccountBonus", "Mature bonus", 0, 100],
                ["trust.newAccountPenalty", "New penalty", 0, 100],
                ["trust.verifiedBonus", "Verified bonus", 0, 100],
                ["trust.kycBonus", "KYC bonus", 0, 100],
                ["trust.phoneVerifiedBonus", "Phone bonus", 0, 100],
                ["trust.stableDeviceBonus", "Stable device bonus", 0, 100],
                ["trust.failedAuthPenaltyEach", "Penalty mỗi fail", 0, 100],
                ["trust.failedAuthPenaltyMax", "Penalty fail tối đa", 0, 100],
              ].map(([path, label, min, max]) => (
                <NumberSetting
                  key={path}
                  label={label}
                  value={getPathValue(draft, path, 0)}
                  min={min}
                  max={max}
                  onChange={(value) => setValue(path, value)}
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<TravelExploreIcon color="primary" />}
              title="Action và nội dung hiển thị"
              subtitle="Thông điệp user-facing không lộ IP, token hoặc threshold."
            />
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {[
                ["actions.highRisk", "High risk"],
                ["actions.watch", "Watch"],
                ["actions.normal", "Normal"],
                ["actions.highTrust", "High trust"],
              ].map(([path, label]) => (
                <Select
                  key={path}
                  size="small"
                  value={getPathValue(draft, path, "allow")}
                  onChange={(event) => setValue(path, event.target.value)}
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="allow">{label}: allow</MenuItem>
                  <MenuItem value="monitor">{label}: monitor</MenuItem>
                  <MenuItem value="challenge">{label}: challenge</MenuItem>
                  <MenuItem value="cooldown">{label}: cooldown</MenuItem>
                  <MenuItem value="lock">{label}: lock</MenuItem>
                </Select>
              ))}
            </Stack>
            <Stack spacing={1.5}>
              {[
                ["explainableUx.normalUserMessage", "Thông báo user khi bình thường"],
                ["explainableUx.riskyUserMessage", "Thông báo user khi rủi ro"],
                ["explainableUx.normalChallengeCopy", "Challenge copy bình thường"],
                ["explainableUx.riskyChallengeCopy", "Challenge copy khi rủi ro"],
              ].map(([path, label]) => (
                <TextField
                  key={path}
                  label={label}
                  value={getPathValue(draft, path, "")}
                  onChange={(event) => setValue(path, event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="outlined" onClick={handleResetDefaults}>
          Khôi phục mặc định
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Lưu cấu hình
        </Button>
      </Stack>
    </Stack>
  );
}

export default function IdentitySecurityPage() {
  const [tab, setTab] = useState("dashboard");
  const [days, setDays] = useState(30);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [explanation, setExplanation] = useState(null);
  const [settingsApplied, setSettingsApplied] = useState(false);

  const { data: verifyData, isLoading: verifying } = useVerifyQuery();
  const isSuperAdmin = isStrictSuperAdminUser(verifyData?.user);

  const {
    data: settingsResponse,
    isLoading: loadingSettings,
    refetch: refetchSettings,
  } = useGetIdentitySecuritySettingsQuery(undefined, { skip: !isSuperAdmin });

  useEffect(() => {
    if (settingsApplied || !settingsResponse?.settings?.analysis?.defaultWindowDays) return;
    setSettingsApplied(true);
    setDays(settingsResponse.settings.analysis.defaultWindowDays);
  }, [settingsApplied, settingsResponse]);

  const {
    data: overview,
    error: overviewError,
    isLoading: loadingOverview,
    isFetching: fetchingOverview,
    refetch,
  } = useGetIdentitySecurityOverviewQuery(
    { days, limit: settingsResponse?.settings?.analysis?.overviewLimit || 12 },
    { skip: !isSuperAdmin },
  );

  const accounts = overview?.accounts || [];

  useEffect(() => {
    if (!selectedUserId && accounts[0]?.user?._id) {
      setSelectedUserId(accounts[0].user._id);
    }
  }, [accounts, selectedUserId]);

  const {
    data: detail,
    isLoading: loadingDetail,
    isFetching: fetchingDetail,
    error: detailError,
  } = useGetIdentitySecurityUserQuery(
    { userId: selectedUserId, days },
    { skip: !isSuperAdmin || !selectedUserId },
  );

  const [explainUser, { isLoading: explaining }] = useExplainIdentitySecurityUserMutation();
  const [updateSettings, { isLoading: savingSettings }] =
    useUpdateIdentitySecuritySettingsMutation();

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.user?._id === selectedUserId),
    [accounts, selectedUserId],
  );

  const handleExplain = async () => {
    if (!selectedUserId) return;
    const result = await explainUser({ userId: selectedUserId, days }).unwrap();
    setExplanation(result?.explanation || null);
  };

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
    setExplanation(null);
  };

  const handleSaveSettings = async (payload) => {
    await updateSettings(payload).unwrap();
    await refetchSettings();
    await refetch();
  };

  if (verifying) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3}>
          <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
            <CircularProgress />
          </Card>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Identity Security
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Identity Graph, Behavioral Baseline, Session Forensics và Trust Score.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select size="small" value={days} onChange={(event) => setDays(Number(event.target.value))}>
                <MenuItem value={7}>7 ngày</MenuItem>
                <MenuItem value={30}>30 ngày</MenuItem>
                <MenuItem value={90}>90 ngày</MenuItem>
              </Select>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
                Làm mới
              </Button>
            </Stack>
          </Stack>

          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            <Tab value="dashboard" label="Dashboard" />
            <Tab value="settings" label="Settings" />
          </Tabs>

          {(fetchingOverview || fetchingDetail) && <LinearProgress />}

          {tab === "settings" ? (
            loadingSettings ? (
              <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
                <CircularProgress />
              </Card>
            ) : (
              <SettingsPanel
                settingsResponse={settingsResponse}
                onSave={handleSaveSettings}
                saving={savingSettings}
              />
            )
          ) : loadingOverview ? (
            <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Đang tải dữ liệu Identity Security...
              </Typography>
            </Card>
          ) : overviewError ? (
            <Alert severity="error">
              {overviewError?.data?.message || "Không tải được dữ liệu Identity Security."}
            </Alert>
          ) : (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} xl={3}>
                  <MetricCard
                    label="Auth events"
                    value={overview?.summary?.totalEvents || 0}
                    caption={`${overview?.summary?.failureRate || 0}% failure rate`}
                    icon={<TimelineIcon color="primary" />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} xl={3}>
                  <MetricCard
                    label="Failed events"
                    value={overview?.summary?.failedEvents || 0}
                    caption={`${overview?.summary?.successEvents || 0} event thành công`}
                    icon={<SecurityIcon color="warning" />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} xl={3}>
                  <MetricCard
                    label="Accounts scanned"
                    value={overview?.summary?.accountsScanned || 0}
                    caption={`${overview?.summary?.watchAccounts || 0} account cần theo dõi`}
                    icon={<AccountTreeIcon color="primary" />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} xl={3}>
                  <MetricCard
                    label="Selected account"
                    value={selectedAccount?.trust?.score ?? "-"}
                    caption={selectedAccount?.user?.name || selectedAccount?.user?.email || "Chưa chọn account"}
                    icon={<PsychologyIcon color="primary" />}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={4}>
                  <AccountList
                    accounts={accounts}
                    selectedUserId={selectedUserId}
                    onSelect={handleSelectUser}
                  />
                </Grid>
                <Grid item xs={12} lg={8}>
                  <Stack spacing={2}>
                    {loadingDetail ? (
                      <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
                        <CircularProgress />
                      </Card>
                    ) : detailError ? (
                      <Alert severity="error">
                        {detailError?.data?.message || "Không tải được chi tiết tài khoản."}
                      </Alert>
                    ) : detail ? (
                      <>
                        <TrustPanel detail={detail} />
                        <ExplainablePanel
                          detail={detail}
                          explanation={explanation}
                          onExplain={handleExplain}
                          explaining={explaining}
                        />
                        <BaselinePanel detail={detail} />
                        <GraphPanel detail={detail} />
                        <SessionPanel detail={detail} />
                      </>
                    ) : (
                      <Alert severity="info">Chọn một tài khoản để xem chi tiết.</Alert>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          )}
        </Stack>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
