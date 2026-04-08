const fs = require('fs');
let content = fs.readFileSync('LiveRecordingMonitorPage.jsx', 'utf8');

content = content.replace(/import SearchIcon from \"@mui\/icons-material\/Search\";/, 'import SearchIcon from \"@mui/icons-material/Search\";\nimport DeleteOutlineIcon from \"@mui/icons-material/DeleteOutline\";');

content = content.replace(/function ActionsCell\(\{ row, onForceExport, forceExportingId \}\) \{/, 'function ActionsCell({ row, onForceExport, forceExportingId, onCleanR2, cleaningR2Id }) {');

content = content.replace(/Xem trước\r?\n\s*<\/Button>\r?\n\s*\) : null\}\r?\n\s*<\/Stack>/, 'Xem trước\n        </Button>\n      ) : null}\n      {Number(row.r2SourceBytes) > 0 ? (\n        <Button\n          size=\"small\"\n          color=\"error\"\n          variant=\"outlined\"\n          onClick={(event) => {\n            event.stopPropagation();\n            onCleanR2?.(row);\n          }}\n          disabled={cleaningR2Id === row.recordingId}\n          startIcon={<DeleteOutlineIcon />}\n          sx={{ minWidth: 0 }}\n        >\n          {cleaningR2Id === row.recordingId ? \"Đang dọn...\" : \"Dọn R2\"}\n        </Button>\n      ) : null}\n    </Stack>');

content = content.replace(/\[forceExportingId, forceLiveRecordingExport, refresh\]\r?\n\s*\);\r?\n\r?\n\s*const columns = useMemo\(/, '[forceExportingId, forceLiveRecordingExport, refresh]\n  );\n\n  const handleCleanR2 = React.useCallback(\n    async (row) => {\n      if (!row?.recordingId || cleaningR2Id) return;\n      if (!window.confirm(\"Bạn có chắc chắn muốn xoá toàn bộ dữ liệu R2 của trận này? Dữ liệu không thể phục hồi!\")) return;\n\n      setActionError(\"\");\n      setCleaningR2Id(row.recordingId);\n      try {\n        await trashLiveRecordingR2Assets(row.recordingId).unwrap();\n        await refresh();\n      } catch (error) {\n        setActionError(\n          error?.data?.message || error?.error || \"Không thể dọn dẹp R2.\"\n        );\n      } finally {\n        setCleaningR2Id(null);\n      }\n    },\n    [cleaningR2Id, trashLiveRecordingR2Assets, refresh]\n  );\n\n  const columns = React.useMemo(');

content = content.replace(/<ActionsCell\r?\n\s*row=\{row\}\r?\n\s*onForceExport=\{handleForceExport\}\r?\n\s*forceExportingId=\{forceExportingId\}\r?\n\s*\/>\r?\n\s*\),\r?\n\s*\},\r?\n\s*\],\r?\n\s*\[forceExportingId, handleForceExport\]/, '<ActionsCell\n            row={row}\n            onForceExport={handleForceExport}\n            forceExportingId={forceExportingId}\n            onCleanR2={handleCleanR2}\n            cleaningR2Id={cleaningR2Id}\n          />\n        ),\n      },\n    ],\n    [forceExportingId, handleForceExport, cleaningR2Id, handleCleanR2]');

fs.writeFileSync('LiveRecordingMonitorPage.jsx', content);
console.log('Patched');
