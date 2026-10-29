import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

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

// ISO-639-1 与各官方翻译平台语言代码映射
const BAIDU_LANG: Record<string, string> = {
  "zh-CN": "zh",
  "zh-TW": "cht",
  "en": "en",
  "ja": "jp",
  "ko": "kor",
  "fr": "fra",
  "de": "de",
  "es": "spa",
  "ru": "ru",
  "pt": "pt",
  "it": "it",
  "ar": "ara",
  "th": "th",
  "vi": "vie",
  "id": "id",
  "ms": "ms",
  "hi": "hi",
  "tr": "tr",
  "nl": "nl",
  "pl": "pl",
  "uk": "uk",
};
const YOUDAO_LANG: Record<string, string> = {
  "zh-CN": "zh-CHS",
  "zh-TW": "zh-CHT",
  "en": "en",
  "ja": "ja",
  "ko": "ko",
  "fr": "fr",
  "de": "de",
  "es": "es",
  "ru": "ru",
  "pt": "pt",
  "it": "it",
  "ar": "ar",
  "th": "th",
  "vi": "vi",
  "id": "id",
  "ms": "ms",
  "hi": "hi",
  "tr": "tr",
  "nl": "nl",
  "pl": "pl",
  "uk": "uk",
};

function mapLang(code: string, provider: "baidu" | "youdao"): string {
  if (code === "auto") return "auto";
  const map = provider === "baidu" ? BAIDU_LANG : YOUDAO_LANG;
  return map[code] || code;
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

async function translateBaidu(text: string, source: string, target: string) {
  const appid = process.env.baidu_app_id;
  const key = process.env.baidu_app_key;
  if (!appid || !key) return null; // 未配置则跳过
  const from = mapLang(source, "baidu");
  const to = mapLang(target, "baidu");
  const salt = String(Date.now());
  const sign = crypto
    .createHash("md5")
    .update(appid + text + salt + key)
    .digest("hex");
  const params = new URLSearchParams({ q: text, from, to, appid, salt, sign });
  const { ctrl, id } = withTimeout(8000);
  try {
    const res = await fetch(
      "https://fapi.baidu.com/api/trans/vip/translate",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: ctrl.signal,
      }
    );
    const data = await res.json();
    if (data.error_code) throw new Error("baidu_error_" + data.error_code);
    const translated = (data.trans_result || [])
      .map((r: any) => r.dst)
      .join("\n");
    if (!translated) throw new Error("baidu_empty");
    return { translated, detected: null, engine: "baidu" };
  } finally {
    clearTimeout(id);
  }
}

async function translateYoudao(text: string, source: string, target: string) {
  const appKey = process.env.youdao_app_key;
  const secret = process.env.youdao_app_secret;
  if (!appKey || !secret) return null; // 未配置则跳过
  const from = mapLang(source, "youdao");
  const to = mapLang(target, "youdao");
  const salt = String(Date.now());
  const curtime = String(Math.floor(Date.now() / 1000));
  const input =
    text.length > 20
      ? text.slice(0, 10) + text.length + text.slice(-10)
      : text;
  const sign = crypto
    .createHash("sha256")
    .update(appKey + input + salt + curtime + secret)
    .digest("hex");
  const params = new URLSearchParams({
    q: text,
    from,
    to,
    appKey,
    salt,
    sign,
    curtime,
    signType: "v3",
  });
  const { ctrl, id } = withTimeout(8000);
  try {
    const res = await fetch("https://openapi.youdao.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (data.errorCode !== "0") throw new Error("youdao_error_" + data.errorCode);
    const translated = (data.translation || []).join("\n");
    if (!translated) throw new Error("youdao_empty");
    return { translated, detected: null, engine: "youdao" };
  } finally {
    clearTimeout(id);
  }
}

async function translateMyMemory(
  text: string,
  source: string,
  target: string
) {
  // source=auto 时让 MyMemory 自动检测源语言（避免误用 en 作源）
  const src = source === "auto" ? "autodetect" : source;
  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(src)}|${encodeURIComponent(target)}` +
    "&mt=1"; // 强制机器翻译，避免返回语料库无关匹配
  const { ctrl, id } = withTimeout(8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`mymemory_status_${res.status}`);
    const data = await res.json();
    if (data.responseStatus && Number(data.responseStatus) !== 200) {
      throw new Error(data.responseDetails || "mymemory_error");
    }
    const translated = data.responseData?.translatedText || "";
    // 配额耗尽时 MyMemory 返回的是警告文本而非译文，需拦截
    if (/MYMEMORY WARNING|YOU USED ALL|QUOTA/i.test(translated)) {
      throw new Error("mymemory_quota");
    }
    if (!translated) throw new Error("mymemory_empty");
    const detected =
      typeof data.responseData?.detectedLanguage === "string"
        ? data.responseData.detectedLanguage
        : null;
    return { translated, detected, engine: "mymemory" };
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

    // 引擎优先级：Google(无需key) → 百度官方(需key) → 有道官方(需key) → MyMemory(无需key)
    // 任一成功即返回；配置的官方引擎失败则自动跳过，继续下一个
    try {
      const r = await translateGoogle(text, source, target);
      return NextResponse.json(r);
    } catch {}

    try {
      const baidu = await translateBaidu(text, source, target);
      if (baidu) return NextResponse.json(baidu);
    } catch {}

    try {
      const youdao = await translateYoudao(text, source, target);
      if (youdao) return NextResponse.json(youdao);
    } catch {}

    try {
      const r = await translateMyMemory(text, source, target);
      return NextResponse.json(r);
    } catch {
      return NextResponse.json(
        { error: "翻译服务暂不可用，请稍后重试" },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "请求解析失败" },
      { status: 400 }
    );
  }
}
