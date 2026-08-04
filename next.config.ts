import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "bwip-js", "exceljs"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
