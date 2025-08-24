// src/layouts/match/AdminMatchLogsPanel.jsx
import { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const TYPE_COLOR = {
  point: "success",
  undo: "default",
  start: "info",
  finish: "info",
  forfeit: "warning",
  serve: "secondary",
  sideout: "secondary",
  rotate: "secondary",
};

export default function AdminMatchLogsPanel({ logs = [], onRefresh, auto, setAuto }) {
  const [copied, setCopied] = useState(false);

  const rows = useMemo(
    () =>
      (logs || []).map((r, i) => ({
        id: r._id || `${r.at || ""}-${i}`, // DataGrid cần 'id'
        idx: r.idx ?? i,
        at: r.at || null,
        type: r.type,
        by: r.by || null,
        payload: r.payload ?? null,
      })),
    [logs]
  );

  const columns = useMemo(
    () => [
      {
        field: "idx",
        headerName: "#",
        width: 70,
        sortable: false,
        headerAlign: "left",
        align: "left",
      },
      {
        field: "at",
        headerName: "Time",
        width: 210,
        valueGetter: (params) => params.row.at,
        renderCell: (params) => {
          const v = params.value;
          return v ? (
            <Stack sx={{ lineHeight: 1.1 }}>
              <Typography variant="body2">{dayjs(v).format("YYYY-MM-DD HH:mm:ss")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {dayjs(v).fromNow()}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          );
        },
        sortable: true,
      },
      {
        field: "type",
        headerName: "Type",
        width: 140,
        sortable: false,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.value || "—"}
            color={TYPE_COLOR[params.value] || "default"}
          />
        ),
      },
      {
        field: "by",
        headerName: "By",
        width: 260,
        sortable: false,
        renderCell: (params) =>
          params.value ? (
            <Stack sx={{ lineHeight: 1.1 }}>
              <Typography variant="body2">
                {params.value.nickname || params.value.name || "—"}
              </Typography>
              {params.value.name && (
                <Typography variant="caption" color="text.secondary">
                  {params.value.name}
                </Typography>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          ),
      },
      {
        field: "payload",
        headerName: "Payload",
        flex: 1,
        minWidth: 280,
        sortable: false,
        renderCell: (params) => (
          <Box
            component="pre"
            sx={{
              m: 0,
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {params.value ? JSON.stringify(params.value) : "—"}
          </Box>
        ),
      },
    ],
    []
  );

  const pretty = useMemo(() => JSON.stringify(logs || [], null, 2), [logs]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Live log</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControlLabel
            control={<Switch checked={!!auto} onChange={(e) => setAuto?.(e.target.checked)} />}
            label="Auto refresh"
          />
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={copied ? "Copied!" : "Copy JSON"}>
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(pretty);
                setCopied(true);
              }}
            >
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      {/* DataGrid canh header/body tuyệt đối, không lệch khi có scrollbar */}
      <Box sx={{ height: 480, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          disableColumnMenu
          sortingOrder={["desc", "asc"]}
          initialState={{
            sorting: { sortModel: [{ field: "at", sort: "desc" }] },
          }}
          pageSizeOptions={[50, 100]}
          getRowHeight={() => "auto"} // cho phép dòng cao khi payload dài
          disableRowSelectionOnClick
          sx={{
            "& .MuiDataGrid-cell": { alignItems: "start" },
            "& .MuiDataGrid-columnHeaders": { position: "sticky", top: 0, zIndex: 1 },
          }}
        />
      </Box>
    </Paper>
  );
}

AdminMatchLogsPanel.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      idx: PropTypes.number,
      type: PropTypes.string.isRequired,
      at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      by: PropTypes.shape({
        _id: PropTypes.string,
        name: PropTypes.string,
        nickname: PropTypes.string,
        avatar: PropTypes.string,
      }),
      payload: PropTypes.any,
    })
  ),
  onRefresh: PropTypes.func.isRequired,
  auto: PropTypes.bool,
  setAuto: PropTypes.func,
};

AdminMatchLogsPanel.defaultProps = {
  logs: [],
  auto: true,
};
