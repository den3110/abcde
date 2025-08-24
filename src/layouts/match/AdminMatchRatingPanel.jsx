// src/layouts/match/AdminMatchRatingPanel.jsx
import * as React from "react";
import PropTypes from "prop-types";
import { Box, Paper, Stack, Typography, Chip } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

const fmt3 = (v) => (typeof v === "number" ? v.toFixed(3) : "—");
const fmtPct1 = (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");
const fmtPct0 = (v) => (typeof v === "number" ? `${(v * 100).toFixed(0)}%` : "—");
const fmtDate = (v) => {
  if (!v) return "—";
  const d = typeof v === "string" || v instanceof Date ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleString() : "—";
};

function NoRows() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center" spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Chưa có rating log.
      </Typography>
    </Stack>
  );
}

export default function AdminMatchRatingPanel({ rows }) {
  const columns = React.useMemo(
    () => [
      {
        field: "user",
        headerName: "User",
        flex: 1.2,
        minWidth: 180,
        sortable: false,
        // ✅ Dùng params đúng chuẩn
        valueGetter: (params) => params.row?.user || null,
        renderCell: (params) => {
          const u = params.value || {};
          const main = u?.nickname || u?.name || u?._id || "—";
          const sub = u?.name && u?.nickname ? u?.name : null;
          return (
            <Stack sx={{ py: 0.5 }}>
              <Typography variant="body2">{main}</Typography>
              {sub && (
                <Typography variant="caption" color="text.secondary">
                  {sub}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: "kind",
        headerName: "Kind",
        width: 110,
        sortable: false,
        renderCell: (params) => <Chip size="small" label={params.value || "—"} />,
      },
      {
        field: "before",
        headerName: "Before",
        type: "number",
        width: 110,
        align: "right",
        headerAlign: "right",
        valueFormatter: ({ value }) => fmt3(value),
      },
      {
        field: "delta",
        headerName: "Δ",
        type: "number",
        width: 110,
        align: "right",
        headerAlign: "right",
        valueFormatter: ({ value }) =>
          typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(3)}` : "—",
        cellClassName: (params) => {
          const v = params.value;
          if (typeof v !== "number") return "";
          return v >= 0 ? "pt-positive" : "pt-negative";
        },
      },
      {
        field: "after",
        headerName: "After",
        type: "number",
        width: 110,
        align: "right",
        headerAlign: "right",
        valueFormatter: ({ value }) => fmt3(value),
      },
      {
        field: "expected",
        headerName: "Expected",
        type: "number",
        width: 120,
        align: "right",
        headerAlign: "right",
        valueFormatter: ({ value }) => fmtPct1(value),
      },
      {
        field: "score",
        headerName: "Score",
        type: "number",
        width: 100,
        align: "right",
        headerAlign: "right",
        valueFormatter: ({ value }) => (typeof value === "number" ? value : "—"),
      },
      {
        field: "reliab",
        headerName: "Reliab. →",
        width: 150,
        align: "right",
        headerAlign: "right",
        sortable: false,
        // ✅ Đúng chuẩn params và an toàn null
        valueGetter: (params) => {
          const rb = params.row?.reliabilityBefore;
          const ra = params.row?.reliabilityAfter;
          return `${fmtPct0(rb)} → ${fmtPct0(ra)}`;
        },
      },
      {
        field: "marginBonus",
        headerName: "Margin",
        type: "number",
        width: 110,
        align: "right",
        headerAlign: "right",
        valueFormatter: ({ value }) => fmtPct0(value),
      },
      {
        field: "createdAt",
        headerName: "Time",
        flex: 0.9,
        minWidth: 180,
        valueFormatter: ({ value }) => fmtDate(value),
        sortComparator: (a, b) => {
          const ta = new Date(a).getTime() || 0;
          const tb = new Date(b).getTime() || 0;
          return ta - tb;
        },
      },
    ],
    []
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Rating changes
      </Typography>
      <Box sx={{ width: "100%" }}>
        <DataGrid
          autoHeight
          rows={rows || []}
          columns={columns}
          getRowId={(r) => r._id}
          density="compact"
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar, noRowsOverlay: NoRows }}
          initialState={{
            sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{
            "& .pt-positive": { color: "#0a7", fontWeight: 600 },
            "& .pt-negative": { color: "#d33", fontWeight: 600 },
          }}
        />
      </Box>
    </Paper>
  );
}

AdminMatchRatingPanel.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      user: PropTypes.shape({
        _id: PropTypes.string,
        name: PropTypes.string,
        nickname: PropTypes.string,
      }),
      kind: PropTypes.string,
      before: PropTypes.number,
      delta: PropTypes.number,
      after: PropTypes.number,
      expected: PropTypes.number, // 0..1
      score: PropTypes.number,
      reliabilityBefore: PropTypes.number, // 0..1
      reliabilityAfter: PropTypes.number, // 0..1
      marginBonus: PropTypes.number, // 0..1
      createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    })
  ),
};

AdminMatchRatingPanel.defaultProps = { rows: [] };
