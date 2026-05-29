import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import ScienceIcon from "@mui/icons-material/Science";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useGetAiGatewayConfigQuery,
  useListAiGatewayModelsMutation,
  useTestAiGatewayEndpointMutation,
  useUpdateAiGatewayConfigMutation,
} from "slices/aiGatewayApiSlice";

const SCOPE_META = [
  { key: "cccd", label: "CCCD / KYC", desc: "Đọc ảnh CCCD và auto review KYC." },
  { key: "poster", label: "Poster / ảnh đăng ký", desc: "AI đọc poster và ảnh liên quan đăng ký." },
  { key: "default", label: "AI mặc định", desc: "Các luồng AI dùng client OpenAI chung." },
];

const emptyScope = {
  enabled: true,
  endpointIds: [],
  model: "",
  fallbackToEnv: true,
};

const makeId = () =>
  `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeConfig = (config = {}) => ({
  enabled: config.enabled !== false,
  strategy: config.strategy === "roundRobin" ? "roundRobin" : "failover",
  timeoutMs: config.timeoutMs ?? 45000,
  failureCooldownMs: config.failureCooldownMs ?? 60000,
  endpoints: Array.isArray(config.endpoints) ? config.endpoints : [],
  scopes: {
    cccd: { ...emptyScope, ...(config.scopes?.cccd || {}) },
    poster: { ...emptyScope, ...(config.scopes?.poster || {}) },
    default: { ...emptyScope, ...(config.scopes?.default || {}) },
  },
});

const newEndpoint = () => ({
  id: makeId(),
  label: "AI endpoint",
  baseUrl: "",
  apiKey: "",
  enabled: true,
  priority: 100,
  timeoutMs: 45000,
  defaultModel: "",
  notes: "",
});

const pickSuggestedModel = (models = []) => {
  const list = models.filter(Boolean);
  const preferred = [
    /^gpt-5/i,
    /^gpt-4\.1/i,
    /^gpt-4o/i,
    /vision/i,
    /flash/i,
  ];
  for (const pattern of preferred) {
    const found = list.find((model) => pattern.test(model));
    if (found) return found;
  }
  return list[0] || "";
};

export default function AiGatewaySettingsPage() {
  const { data, isLoading, isError, refetch } = useGetAiGatewayConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateAiGatewayConfigMutation();
  const [listModels, { isLoading: isLoadingModels }] = useListAiGatewayModelsMutation();
  const [testEndpoint, { isLoading: isTesting }] = useTestAiGatewayEndpointMutation();
  const [form, setForm] = useState(null);
  const [modelOptions, setModelOptions] = useState({});

  useEffect(() => {
    if (data?.config) {
      const next = normalizeConfig(data.config);
      setForm(next);
      const initialOptions = {};
      next.endpoints.forEach((endpoint) => {
        if (endpoint.defaultModel) initialOptions[endpoint.id] = [endpoint.defaultModel];
      });
      setModelOptions(initialOptions);
    }
  }, [data]);

  const endpointLabelById = useMemo(() => {
    const map = new Map();
    (form?.endpoints || []).forEach((endpoint) => {
      map.set(endpoint.id, endpoint.label || endpoint.baseUrl || endpoint.id);
    });
    return map;
  }, [form?.endpoints]);

  const updateRoot = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateEndpoint = (id, patch) => {
    setForm((prev) => ({
      ...prev,
      endpoints: prev.endpoints.map((endpoint) =>
        endpoint.id === id ? { ...endpoint, ...patch } : endpoint
      ),
    }));
  };

  const updateScope = (scopeKey, patch) => {
    setForm((prev) => ({
      ...prev,
      scopes: {
        ...prev.scopes,
        [scopeKey]: { ...prev.scopes[scopeKey], ...patch },
      },
    }));
  };

  const addEndpoint = () => {
    setForm((prev) => ({
      ...prev,
      endpoints: [...prev.endpoints, newEndpoint()],
    }));
  };

  const removeEndpoint = (id) => {
    setForm((prev) => ({
      ...prev,
      endpoints: prev.endpoints.filter((endpoint) => endpoint.id !== id),
      scopes: Object.fromEntries(
        Object.entries(prev.scopes).map(([scopeKey, scope]) => [
          scopeKey,
          {
            ...scope,
            endpointIds: (scope.endpointIds || []).filter((endpointId) => endpointId !== id),
          },
        ])
      ),
    }));
  };

  const handleFetchModels = async (endpoint) => {
    try {
      const result = await listModels({
        endpointId: endpoint.id,
        baseUrl: endpoint.baseUrl,
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }).unwrap();
      const models = result.models || [];
      setModelOptions((prev) => ({ ...prev, [endpoint.id]: models }));
      if (!endpoint.defaultModel && models.length) {
        updateEndpoint(endpoint.id, { defaultModel: pickSuggestedModel(models) });
      }
      toast.success(`Đã tải ${models.length} model.`);
    } catch (error) {
      toast.error(error?.data?.message || error?.error || "Không tải được danh sách model.");
    }
  };

  const handleTestEndpoint = async (endpoint) => {
    try {
      const result = await testEndpoint({
        endpointId: endpoint.id,
        baseUrl: endpoint.baseUrl,
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }).unwrap();
      toast.success(`Endpoint hoạt động: ${result.modelCount || 0} model, ${result.latencyMs}ms.`);
    } catch (error) {
      toast.error(error?.data?.message || error?.error || "Endpoint đang lỗi.");
    }
  };

  const handleSave = async () => {
    try {
      await updateConfig({ aiGateway: form }).unwrap();
      toast.success("Đã lưu cấu hình AI Gateway.");
      refetch();
    } catch (error) {
      toast.error(error?.data?.message || error?.error || "Không lưu được cấu hình.");
    }
  };

  const buildScopeModelOptions = (scope) => {
    const ids = scope.endpointIds?.length
      ? scope.endpointIds
      : (form?.endpoints || []).map((endpoint) => endpoint.id);
    const models = ids.flatMap((id) => modelOptions[id] || []);
    if (scope.model && !models.includes(scope.model)) models.unshift(scope.model);
    return [...new Set(models)];
  };

  if (isLoading || !form) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box py={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={22} />
              <Typography>Đang tải cấu hình AI Gateway...</Typography>
            </Stack>
          </Paper>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", md: "center" }}
              spacing={2}
            >
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Cấu hình AI Gateway
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Quản lý endpoint OpenAI-compatible, tự tải model và xoay endpoint khi lỗi.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={refetch} startIcon={<RefreshIcon />}>
                  Tải lại
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isSaving}
                  startIcon={isSaving ? <CircularProgress size={18} /> : <SaveIcon />}
                >
                  {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {isError ? (
            <Alert severity="error">Không đọc được cấu hình AI Gateway.</Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>
                Thiết lập chung
              </Typography>
              <Divider />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={600}>Bật AI Gateway runtime</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Khi tắt, hệ thống quay về fallback từ ENV.
                  </Typography>
                </Box>
                <Switch
                  checked={form.enabled !== false}
                  onChange={(event) => updateRoot("enabled", event.target.checked)}
                />
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  label="Chiến lược"
                  value={form.strategy}
                  onChange={(event) => updateRoot("strategy", event.target.value)}
                  fullWidth
                >
                  <MenuItem value="failover">Failover theo ưu tiên</MenuItem>
                  <MenuItem value="roundRobin">Xoay vòng</MenuItem>
                </TextField>
                <TextField
                  label="Timeout mỗi endpoint (ms)"
                  type="number"
                  value={form.timeoutMs}
                  onChange={(event) => updateRoot("timeoutMs", Number(event.target.value))}
                  fullWidth
                />
                <TextField
                  label="Thời gian nghỉ khi lỗi (ms)"
                  type="number"
                  value={form.failureCooldownMs}
                  onChange={(event) => updateRoot("failureCooldownMs", Number(event.target.value))}
                  fullWidth
                />
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Endpoint
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nhập URL gateway, tải model từ API `/models`, rồi chọn model mặc định.
                  </Typography>
                </Box>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={addEndpoint}>
                  Thêm endpoint
                </Button>
              </Stack>
              <Divider />

              {form.endpoints.length === 0 ? (
                <Alert severity="info">Chưa có endpoint trong DB. Hệ thống đang dùng ENV fallback.</Alert>
              ) : null}

              {form.endpoints.map((endpoint, index) => {
                const models = modelOptions[endpoint.id] || [];
                const modelItems = endpoint.defaultModel && !models.includes(endpoint.defaultModel)
                  ? [endpoint.defaultModel, ...models]
                  : models;

                return (
                  <Paper key={endpoint.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography fontWeight={700}>Endpoint #{index + 1}</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {endpoint.apiKeySet ? <Chip size="small" label="Đã lưu key" /> : null}
                          <Switch
                            checked={endpoint.enabled !== false}
                            onChange={(event) =>
                              updateEndpoint(endpoint.id, { enabled: event.target.checked })
                            }
                          />
                          <Tooltip title="Xóa endpoint">
                            <IconButton color="error" onClick={() => removeEndpoint(endpoint.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          label="Tên"
                          value={endpoint.label || ""}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, { label: event.target.value })
                          }
                          fullWidth
                        />
                        <TextField
                          label="Base URL"
                          value={endpoint.baseUrl || ""}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, { baseUrl: event.target.value })
                          }
                          placeholder="http://127.0.0.1:8317/v1"
                          fullWidth
                        />
                      </Stack>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          label="API key"
                          type="password"
                          value={endpoint.apiKey || ""}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, { apiKey: event.target.value })
                          }
                          helperText={
                            endpoint.apiKeySet
                              ? "Để trống để giữ key đã lưu."
                              : "Để trống nếu gateway không cần key hoặc dùng ENV fallback."
                          }
                          fullWidth
                        />
                        <TextField
                          label="Ưu tiên"
                          type="number"
                          value={endpoint.priority ?? 100}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, { priority: Number(event.target.value) })
                          }
                          fullWidth
                        />
                        <TextField
                          label="Timeout (ms)"
                          type="number"
                          value={endpoint.timeoutMs ?? 45000}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, { timeoutMs: Number(event.target.value) })
                          }
                          fullWidth
                        />
                      </Stack>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          select
                          label="Model mặc định"
                          value={endpoint.defaultModel || ""}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, { defaultModel: event.target.value })
                          }
                          helperText="Bấm tải models để chọn từ danh sách endpoint cung cấp."
                          fullWidth
                        >
                          <MenuItem value="">Tự chọn theo scope hoặc ENV</MenuItem>
                          {modelItems.map((model) => (
                            <MenuItem key={model} value={model}>
                              {model}
                            </MenuItem>
                          ))}
                        </TextField>
                        <Button
                          variant="outlined"
                          onClick={() => handleFetchModels(endpoint)}
                          disabled={!endpoint.baseUrl || isLoadingModels}
                          startIcon={<RefreshIcon />}
                          sx={{ minWidth: 160 }}
                        >
                          Tải models
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => handleTestEndpoint(endpoint)}
                          disabled={!endpoint.baseUrl || isTesting}
                          startIcon={<ScienceIcon />}
                          sx={{ minWidth: 150 }}
                        >
                          Test
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>
                Phạm vi sử dụng
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Để trống model override để dùng model mặc định của từng endpoint.
              </Typography>
              <Divider />

              {SCOPE_META.map((scopeMeta) => {
                const scope = form.scopes[scopeMeta.key] || emptyScope;
                const scopeModelOptions = buildScopeModelOptions(scope);

                return (
                  <Paper key={scopeMeta.key} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography fontWeight={700}>{scopeMeta.label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {scopeMeta.desc}
                          </Typography>
                        </Box>
                        <Switch
                          checked={scope.enabled !== false}
                          onChange={(event) =>
                            updateScope(scopeMeta.key, { enabled: event.target.checked })
                          }
                        />
                      </Stack>

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          select
                          label="Endpoint được dùng"
                          value={scope.endpointIds || []}
                          onChange={(event) =>
                            updateScope(scopeMeta.key, {
                              endpointIds:
                                typeof event.target.value === "string"
                                  ? event.target.value.split(",")
                                  : event.target.value,
                            })
                          }
                          SelectProps={{
                            multiple: true,
                            renderValue: (selected) =>
                              selected.length
                                ? selected.map((id) => endpointLabelById.get(id) || id).join(", ")
                                : "Tất cả endpoint đang bật",
                          }}
                          fullWidth
                        >
                          {form.endpoints.map((endpoint) => (
                            <MenuItem key={endpoint.id} value={endpoint.id}>
                              <Checkbox checked={(scope.endpointIds || []).includes(endpoint.id)} />
                              <ListItemText primary={endpoint.label || endpoint.baseUrl} />
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Model override"
                          value={scope.model || ""}
                          onChange={(event) =>
                            updateScope(scopeMeta.key, { model: event.target.value })
                          }
                          helperText="Không chọn để dùng model mặc định của endpoint."
                          fullWidth
                        >
                          <MenuItem value="">Tự động theo endpoint</MenuItem>
                          {scopeModelOptions.map((model) => (
                            <MenuItem key={model} value={model}>
                              {model}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>

                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography>Fallback về ENV khi endpoint DB lỗi hoặc trống</Typography>
                        <Switch
                          checked={scope.fallbackToEnv !== false}
                          onChange={(event) =>
                            updateScope(scopeMeta.key, { fallbackToEnv: event.target.checked })
                          }
                        />
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>
                Fallback và trạng thái
              </Typography>
              <Divider />
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                {SCOPE_META.map((scopeMeta) => {
                  const fallback = data?.envFallbacks?.[scopeMeta.key] || {};
                  return (
                    <Alert key={scopeMeta.key} severity={fallback.apiKeySet ? "info" : "warning"} sx={{ flex: 1 }}>
                      <Typography fontWeight={700}>{scopeMeta.label}</Typography>
                      <Typography variant="body2">Model ENV: {fallback.model || "-"}</Typography>
                      <Typography variant="body2">Base URL ENV: {fallback.baseUrl || "-"}</Typography>
                    </Alert>
                  );
                })}
              </Stack>

              {Array.isArray(data?.health) && data.health.length ? (
                <Stack spacing={1}>
                  {data.health.map((item) => (
                    <Alert key={item.key} severity={item.cooling ? "warning" : "success"}>
                      {item.key}: {item.cooling ? "đang nghỉ sau lỗi" : "sẵn sàng"}
                      {item.lastError ? ` - ${item.lastError}` : ""}
                    </Alert>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">Chưa có dữ liệu health trong runtime hiện tại.</Alert>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
