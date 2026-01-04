// pages/api/paystack-banks.ts (Next.js pages router)
import type { NextApiRequest, NextApiResponse } from "next";

let cached: { ts: number; data: any[] } | null = null;
const TTL = 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (cached && Date.now() - cached.ts < TTL) {
      return res.status(200).json({ status: true, data: cached.data });
    }

    const r = await fetch("https://api.paystack.co/bank", {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ status: false, message: "Paystack fetch failed", detail: text });
    }

    const json = await r.json();
    const banks = Array.isArray(json.data) ? json.data : [];
    const mapped = banks.map((b: any) => ({
      name: b.name,
      code: b.code,
      supports_transfer: b.supports_transfer,
      active: b.active,
    }));
    cached = { ts: Date.now(), data: mapped };
    return res.status(200).json({ status: true, data: mapped });
  } catch (err) {
    console.error("API /paystack-banks error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
}
