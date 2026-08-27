/* eslint-disable react/prop-types */
// layouts/user/NameStyleEditor.jsx
// Trình chỉnh "Hiệu ứng tên" cho VĐV (admin) — một màu / gradient nhiều màu / cầu vồng động.
// Shape khớp backend: { effect, color, colors[], angle, animated, speed, bold }.
import React, { useMemo } from "react";
import {
  Box,
  Stack,
  TextField,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
  InputAdornment,
  Tooltip,
  Divider,
  GlobalStyles,
} from "@mui/material";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MDTypography from "components/MDTypography";

const RAINBOW = [
  "#ff0000",
  "#ff9a00",
  "#d0de21",
  "#4fdc4a",
  "#3fdad8",
  "#2fc9e2",
  "#1c7fee",
];

const DEFAULTS = {
  effect: "none",
  color: "#2f80ed",
  colors: RAINBOW,
  angle: 90,
  animated: false,
  speed: 6,
  bold: false,
};

const PRESETS = [
  { label: "🌈 Cầu vồng", colors: RAINBOW, animated: true, speed: 6 },
  { label: "Hoàng hôn", colors: ["#ff512f", "#dd2476"], animated: false },
  { label: "Biển xanh", colors: ["#2193b0", "#6dd5ed"], animated: false },
  { label: "Vàng gold", colors: ["#f7971e", "#ffd200"], animated: true, speed: 5 },
  { label: "Tím neon", colors: ["#8e2de2", "#4a00e0"], animated: true, speed: 6 },
  { label: "Lửa", colors: ["#f83600", "#f9d423"], animated: true, speed: 5 },
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Dựng style xem trước (đồng bộ frontend/src/utils/nameStyle.js).
export function buildPreviewStyle(nsRaw) {
  const ns = nsRaw || {};
  if (ns.effect === "solid" && HEX_RE.test(String(ns.color || ""))) {
    return { color: ns.color, ...(ns.bold ? { fontWeight: 800 } : null) };
  }
  if (ns.effect === "gradient") {
    const colors = (Array.isArray(ns.colors) ? ns.colors : []).filter((c) =>
      HEX_RE.test(String(c || "")),
    );
    if (colors.length >= 2) {
      const stops = ns.animated ? [...colors, ...colors] : colors;
      const style = {
        backgroundImage: `linear-gradient(${ns.angle ?? 90}deg, ${stops.join(", ")})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        backgroundRepeat: "no-repeat",
        ...(ns.bold ? { fontWeight: 800 } : null),
      };
      if (ns.animated) {
        style.backgroundSize = "200% auto";
        style.backgroundPosition = "0% center";
        style.animation = `pkNameShine ${ns.speed || 6}s linear infinite`;
      }
      return style;
    }
  }
  return {};
}

function ColorInput({ value, onChange }) {
  const v = HEX_RE.test(String(value || "")) ? value : "#000000";
  return (
    <TextField
      type="color"
      size="small"
      value={v}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        width: 56,
        "& input[type=color]": {
          p: 0,
          height: 34,
          cursor: "pointer",
        },
      }}
    />
  );
}

export default function NameStyleEditor({ value, onChange, sampleName }) {
  const ns = useMemo(() => ({ ...DEFAULTS, ...(value || {}) }), [value]);
  const set = (patch) => onChange({ ...ns, ...patch });

  const setColorAt = (i, c) => {
    const colors = [...(ns.colors || [])];
    colors[i] = c;
    set({ colors });
  };
  const addColor = () => {
    if ((ns.colors || []).length >= 7) return;
    set({ colors: [...(ns.colors || []), "#ffffff"] });
  };
  const removeColor = (i) => {
    const colors = (ns.colors || []).filter((_, idx) => idx !== i);
    set({ colors: colors.length ? colors : RAINBOW.slice(0, 2) });
  };

  const preview = buildPreviewStyle(ns);
  const sample = sampleName || "Tên VĐV";

  return (
    <Box
      sx={{
        mt: 1.5,
        pt: 1.5,
        borderTop: "1px dashed #e0e0e0",
      }}
    >
      <GlobalStyles
        styles={{
          "@keyframes pkNameShine": {
            from: { backgroundPosition: "0% center" },
            to: { backgroundPosition: "100% center" },
          },
        }}
      />
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <AutoAwesomeIcon fontSize="small" color="warning" />
        <MDTypography variant="button" fontWeight="medium">
          Hiệu ứng tên hiển thị
        </MDTypography>
      </Stack>

      {/* Preview */}
      <Box
        sx={{
          mb: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          bgcolor: "#0f1626",
          textAlign: "center",
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.3,
            ...preview,
          }}
        >
          {sample}
        </Box>
        <MDTypography
          variant="caption"
          display="block"
          sx={{ color: "#8a93a6", mt: 0.5 }}
        >
          Xem trước
        </MDTypography>
      </Box>

      <TextField
        select
        fullWidth
        size="small"
        label="Kiểu hiệu ứng"
        value={ns.effect || "none"}
        onChange={(e) => set({ effect: e.target.value })}
        sx={{ mb: 1.5 }}
      >
        <MenuItem value="none">Không (tên thường)</MenuItem>
        <MenuItem value="solid">Một màu</MenuItem>
        <MenuItem value="gradient">Nhiều màu / Cầu vồng</MenuItem>
      </TextField>

      {ns.effect === "solid" && (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <ColorLensIcon fontSize="small" />
          <MDTypography variant="button">Màu chữ</MDTypography>
          <ColorInput value={ns.color} onChange={(c) => set({ color: c })} />
          <TextField
            size="small"
            value={ns.color || ""}
            onChange={(e) => set({ color: e.target.value })}
            placeholder="#2f80ed"
            sx={{ width: 120 }}
          />
        </Stack>
      )}

      {ns.effect === "gradient" && (
        <Box>
          <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
            Mẫu nhanh
          </MDTypography>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1.5 }}>
            {PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                size="small"
                onClick={() =>
                  set({
                    effect: "gradient",
                    colors: p.colors,
                    animated: !!p.animated,
                    speed: p.speed || 6,
                  })
                }
                sx={{
                  cursor: "pointer",
                  background: `linear-gradient(90deg, ${p.colors.join(", ")})`,
                  color: "#fff",
                  fontWeight: 600,
                }}
              />
            ))}
          </Stack>

          <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
            Các màu ({(ns.colors || []).length}/7)
          </MDTypography>
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
            {(ns.colors || []).map((c, i) => (
              <Stack key={i} direction="row" alignItems="center" spacing={0.25}>
                <ColorInput value={c} onChange={(val) => setColorAt(i, val)} />
                {(ns.colors || []).length > 2 && (
                  <IconButton size="small" onClick={() => removeColor(i)}>
                    <DeleteOutlineIcon fontSize="inherit" />
                  </IconButton>
                )}
              </Stack>
            ))}
            {(ns.colors || []).length < 7 && (
              <Tooltip title="Thêm màu">
                <IconButton size="small" onClick={addColor}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          <Box sx={{ px: 0.5, mb: 1 }}>
            <MDTypography variant="caption" color="text" display="block">
              Góc chuyển màu: {ns.angle ?? 90}°
            </MDTypography>
            <Slider
              size="small"
              min={0}
              max={360}
              value={Number(ns.angle ?? 90)}
              onChange={(_, v) => set({ angle: v })}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={!!ns.animated}
                onChange={(e) => set({ animated: e.target.checked })}
              />
            }
            label="Chạy lấp lánh (cầu vồng động)"
          />

          {ns.animated && (
            <Box sx={{ px: 0.5, mb: 1 }}>
              <MDTypography variant="caption" color="text" display="block">
                Tốc độ: {ns.speed || 6}s / vòng
              </MDTypography>
              <Slider
                size="small"
                min={1}
                max={20}
                value={Number(ns.speed || 6)}
                onChange={(_, v) => set({ speed: v })}
              />
            </Box>
          )}
        </Box>
      )}

      {ns.effect !== "none" && (
        <>
          <Divider sx={{ my: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={!!ns.bold}
                onChange={(e) => set({ bold: e.target.checked })}
              />
            }
            label="In đậm"
          />
        </>
      )}
    </Box>
  );
}
