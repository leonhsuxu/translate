"use client";

import { useState } from "react";
import { LANGUAGES } from "../lib/languages";

export default function Home() {
  const [source, setSource] = useState("auto");
  const [target, setTarget] = useState("zh-CN");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState("");
  const [engine, setEngine] = useState("");

  const sourceName = LANGUAGES.find((l) => l.code === source)?.name || source;
  const targetName = LANGUAGES.find((l) => l.code === target)?.name || target;
  const detectedName =
    detected
      ? LANGUAGES.find((l) => l.code === detected)?.name || detected
      : "";

  async function handleTranslate() {
    const text = input.trim();
    if (!text) {
      setError("请输入要翻译的文本");
      return;
    }
    setLoading(true);
    setError("");
    setOutput("");
    setDetected("");
    setEngine("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, source, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "翻译失败");
        return;
      }
      setOutput(data.translated || "");
      setEngine(data.engine || "");
      setDetected(data.detected || "");
    } catch (e: any) {
      setError(e?.message || "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  function swap() {
    if (source === "auto") return;
    const s = source;
    const t = target;
    setSource(t);
    setTarget(s);
    setInput(output);
    setOutput(input);
    setDetected("");
  }

  async function copy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      /* 忽略复制失败 */
    }
  }

  return (
    <main className="container">
      <header>
        <h1>免费翻译 · Free Translate</h1>
        <p>基于 Google / MyMemory 公开接口，零密钥 · 一键部署 Vercel</p>
      </header>

      <div className="controls">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="源语言"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          className="swap-btn"
          onClick={swap}
          title="交换语言"
          disabled={source === "auto"}
        >
          ⇄
        </button>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="目标语言"
        >
          {LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="panels">
        <div className="panel">
          <div className="panel-head">
            <span>{sourceName}</span>
            <span>{input.length}/5000</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要翻译的文本…"
            maxLength={5000}
          />
        </div>
        <div className="panel">
          <div className="panel-head">
            <span>{targetName}</span>
            {output && (
              <button className="icon-btn" onClick={copy}>
                复制
              </button>
            )}
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="翻译结果将显示在这里…"
          />
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={handleTranslate} disabled={loading}>
          {loading ? "翻译中…" : "翻译"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setInput("");
            setOutput("");
            setDetected("");
            setError("");
          }}
        >
          清空
        </button>
        <span className="status">
          {detectedName && `检测到语言：${detectedName} · `}
          {engine &&
            `引擎：${engine === "google" ? "Google" : "MyMemory"}`}
        </span>
      </div>

      {error && <div className="status error">{error}</div>}

      <div className="footer">
        无需账号、无需 API Key · 全部请求经服务端代理，规避浏览器跨域限制
      </div>
    </main>
  );
}
