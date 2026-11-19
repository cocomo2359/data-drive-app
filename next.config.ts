import type { NextConfig } from "next";

// GitHub Pages serves this project under /<repo-name>/, so the workflow sets
// NEXT_PUBLIC_BASE_PATH=/data-drive-app. Locally it's empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
};

export default nextConfig;
