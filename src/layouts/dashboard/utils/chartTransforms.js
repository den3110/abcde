// src/layouts/dashboard/utils/chartTransforms.js

/** Điền đủ date buckets (labels) cho chuỗi theo range */
export function fillSeries(rangeStartYmd, rangeEndYmd, points) {
  const map = new Map(points.map((p) => [p._id, p.count]));
  const labels = [];
  const data = [];
  const start = new Date(rangeStartYmd);
  const end = new Date(rangeEndYmd);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    labels.push(key);
    data.push(map.get(key) || 0);
  }
  return { labels, data };
}

/** Map sang định dạng ReportsBarChart/ReportsLineChart của template */
export function toBarLineDataset({ title, labels, data }) {
  return {
    labels,
    datasets: { label: title, data },
  };
}
