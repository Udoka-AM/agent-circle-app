import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev runs on a VPS reached over a forwarded port / public IP, so Next must be
  // told these origins may load /_next/* dev resources. Without this the client
  // bundle is blocked and nothing hydrates.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "109.205.181.119",
  ],
};

export default nextConfig;
