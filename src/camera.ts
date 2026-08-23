// camera_stream.py je machine-e cholche sei host thekei stream — hardcoded IP na.
// (Vite env diye override kora jay: VITE_CAMERA_STREAM_URL)
export const CAMERA_STREAM_URL =
  import.meta.env.VITE_CAMERA_STREAM_URL ??
  `http://${window.location.hostname}:8082/stream`;
