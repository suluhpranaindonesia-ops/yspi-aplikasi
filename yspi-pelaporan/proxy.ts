import { NextResponse } from "next/server";

// Header keamanan untuk semua halaman & API yang dirender worker. Berkas statis
// (logo, JS, CSS) dilayani Cloudflare sebelum worker, jadi header-nya ada di
// public/_headers. Samakan keduanya bila diubah.
// CSP sengaja tidak membatasi script (React/RSC memakai skrip inline); yang dikunci:
// dibingkai situs lain, plugin, base URL, dan tujuan form.
const HEADER_AMAN: [string, string][] = [
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
  ["Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'"],
  ["X-Robots-Tag", "noindex, nofollow"],
];

export function proxy() {
  const res = NextResponse.next();
  for (const [k, v] of HEADER_AMAN) res.headers.set(k, v);
  return res;
}
