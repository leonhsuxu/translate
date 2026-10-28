import { NextRequest, NextResponse } from "next/server";

interface TranslateBody {
  text?: string;
  source?: string;
  target?: string;
}

function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, id };
}

async function translateGoogle(text: string, source: string, target: string) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    `&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;
  const { ctrl, id } = withTimeout(6000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`google_status_${res.status}`);
    const data = await res.json();
    const translated = (Array.isArray(data[0]) ? data[0] : [])
      .map((seg: any) => (seg && seg[0]) || "")
      .join("");
    const detected =
      typeof data[2] === "string" && data[2] ? data[2] : null;
    if (!translated) throw new Error("google_empty");
    return { translated, detected, engine: "google" };
  } finally {
    clearTimeout(id);
  }
}

async function translateMyMemory(
  text: string,
  source: string,
  target: string
) {
  const src = source === "auto" ? "en" : source;
  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(src)}|${encodeURIComponent(target)}`;
  const { ctrl, id } = withTimeout(8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`mymemory_status_${res.status}`);
    const data = await res.json();
    if (data.responseStatus && Number(data.responseStatus) !== 200) {
      throw new Error(data.responseDetails || "mymemory_error");
    }
    return {
      translated: data.responseData?.translatedText || "",
      detected: null,
      engine: "mymemory",
    };
  } finally {
    clearTimeout(id);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;
    const text = (body.text || "").trim();
    const source = body.source || "auto";
    const target = body.target || "zh-CN";

    if (!text) {
      return NextResponse.json({ error: "文本不能为空" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json(
        { error: "文本过长，上限 5000 字符" },
        { status: 400 }
      );
    }

    // 优先 Google 公开接口，失败自动回退 MyMemory，均无需密钥
    try {
      const r = await translateGoogle(text, source, target);
      return NextResponse.json(r);
    } catch {
      try {
        const r = await translateMyMemory(text, source, target);
        return NextResponse.json(r);
      } catch {
        return NextResponse.json(
          { error: "翻译服务暂不可用，请稍后重试" },
          { status: 502 }
        );
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "请求解析失败" },
      { status: 400 }
    );
  }
}
