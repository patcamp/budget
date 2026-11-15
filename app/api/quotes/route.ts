import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import YahooFinanceClass from "yahoo-finance2";

export const runtime = "nodejs";

const MAX_SYMBOLS = 20;

// v3 API: must instantiate the class
const client = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });

export interface QuoteResult {
  price: number;
  name: string;
  changePercent: number;
  /** false when Yahoo lookup failed — UI should show an error, not treat as $0. */
  ok: boolean;
}

interface RawQuote {
  regularMarketPrice?: number;
  shortName?: string;
  longName?: string;
  regularMarketChangePercent?: number;
}

// Cast to allow moduleOptions (needed for mutual funds like FXAIX/VTSAX whose
// response shape doesn't fully match the strict schema — validateResult:false skips it).
const yf = client as unknown as {
  quote: (symbol: string, queryOptions: object, moduleOptions: object) => Promise<RawQuote>;
};

async function requireUser(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
}

export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const param = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [
    ...new Set(
      param
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, MAX_SYMBOLS);

  if (!symbols.length) return NextResponse.json({});

  const results: Record<string, QuoteResult> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await yf.quote(symbol, {}, { validateResult: false });
        const price = q.regularMarketPrice ?? 0;
        results[symbol] = {
          price,
          name: q.shortName ?? q.longName ?? symbol,
          changePercent: q.regularMarketChangePercent ?? 0,
          ok: price > 0,
        };
      } catch {
        results[symbol] = { price: 0, name: symbol, changePercent: 0, ok: false };
      }
    })
  );

  return NextResponse.json(results);
}
