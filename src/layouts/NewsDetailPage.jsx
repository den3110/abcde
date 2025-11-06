import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Typography, Chip, Stack, IconButton, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useGetNewsBySlugQuery } from "slices/newsApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NewsDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useGetNewsBySlugQuery(slug);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Box p={3}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography mt={2} color="error">
          Không tải được bài viết.
          {error?.data?.message ? ` (${error.data.message})` : ""}
        </Typography>
      </Box>
    );
  }

  const article = data;

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box p={3} maxWidth="900px" mx="auto">
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <IconButton onClick={() => navigate(-1)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            Tin tức PickleTour
          </Typography>
        </Box>

        <Typography variant="h4" fontWeight={700} mb={1}>
          {article.title}
        </Typography>

        <Typography variant="body2" color="text.secondary" mb={1.5}>
          {article.sourceName || "Nguồn tổng hợp"} •{" "}
          {formatDateTime(article.originalPublishedAt || article.createdAt)}
        </Typography>

        {article.tags && article.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" mb={2}>
            {article.tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" sx={{ fontSize: 10 }} />
            ))}
          </Stack>
        )}

        {article.heroImageUrl && (
          <Box mb={3}>
            <img
              src={article.heroImageUrl}
              alt={article.title}
              style={{
                width: "100%",
                maxHeight: 420,
                objectFit: "cover",
                borderRadius: 12,
              }}
            />
          </Box>
        )}

        {/* Nội dung HTML đã normalize từ backend */}
        <Box
          className="news-article-content"
          sx={{
            "& p": {
              mb: 1.5,
              fontSize: 15,
              lineHeight: 1.7,
            },
            "& h2": {
              mt: 3,
              mb: 1,
              fontSize: 20,
              fontWeight: 600,
            },
            "& h3": {
              mt: 2,
              mb: 1,
              fontSize: 18,
              fontWeight: 500,
            },
            "& ul, & ol": {
              pl: 3,
              mb: 2,
            },
            "& li": {
              mb: 0.5,
            },
            "& a": {
              textDecoration: "underline",
            },
            "& blockquote": {
              pl: 2,
              borderLeft: "3px solid rgba(0,0,0,0.12)",
              fontStyle: "italic",
              color: "text.secondary",
            },
          }}
          dangerouslySetInnerHTML={{
            __html: article.contentHtml || "",
          }}
        />

        {article.sourceUrl && (
          <Box mt={3}>
            <Typography variant="body2" color="text.secondary">
              Nguồn gốc bài viết:
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <OpenInNewIcon fontSize="small" color="action" />
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
                Xem trên trang gốc
              </a>
            </Box>
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
};

export default NewsDetailPage;
