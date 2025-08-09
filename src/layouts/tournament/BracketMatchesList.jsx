// src/components/BracketMatchesList.jsx
import React from "react";
import { Box, Card, Typography, CircularProgress, Alert, Stack, IconButton } from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { useListMatchesQuery, useDeleteMatchMutation } from "slices/tournamentsApiSlice";

export default function BracketMatchesList({ bracketId }) {
  const { data: matches = [], isLoading, error, refetch } = useListMatchesQuery(bracketId);
  const [deleteMatch] = useDeleteMatchMutation();

  const handleDelete = async (m) => {
    if (!window.confirm("Xóa trận này?")) return;
    try {
      await deleteMatch(m._id).unwrap();
      refetch();
    } catch (e) {
      alert(e?.data?.message || e.error);
    }
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.data?.message || error.error}</Alert>;
  if (matches.length === 0) return <Typography>Chưa có trận nào trong bảng</Typography>;

  return (
    <Stack spacing={1}>
      {matches.map((m) => (
        <Card key={m._id} sx={{ p: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography>
                Vòng {m.round}: {m.pairA.player1.fullName} & {m.pairA.player2.fullName} vs{" "}
                {m.pairB.player1.fullName} & {m.pairB.player2.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                best-of {m.rules.bestOf}, tới {m.rules.pointsToWin}
              </Typography>
            </Box>
            <IconButton onClick={() => handleDelete(m)}>
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
