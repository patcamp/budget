import { NextRequest, NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

export const runtime = "nodejs";

// v3 API: must instantiate the class
const client = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });

export interface QuoteResult {
  price: number;
  name: string;
  changePercent: number;
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

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = param
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) return NextResponse.json({});

  const results: Record<string, QuoteResult> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await yf.quote(symbol, {}, { validateResult: false });
        results[symbol] = {
          price: q.regularMarketPrice ?? 0,
          name: q.shortName ?? q.longName ?? symbol,
          changePercent: q.regularMarketChangePercent ?? 0,
        };
      } catch {
        results[symbol] = { price: 0, name: symbol, changePercent: 0 };
      }
    })
  );

  return NextResponse.json(results);
}
