"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { StockRiskBreakdown } from "@/types/risk";

const BREAKDOWN_LABEL: Record<keyof StockRiskBreakdown, string> = {
  volatility: "波動度",
  fundamental: "基本面",
  valuationQuality: "估值品質",
  sentimentEvent: "新聞情緒",
  macroSector: "總經/產業",
};

/** 分數越高風險越高，用同一組紅→綠色階表示，方便一眼看出哪一類是主要風險來源 */
function barColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#10b981";
}

export function RiskBreakdownChart({ breakdown }: { breakdown: StockRiskBreakdown }) {
  const data = (Object.keys(breakdown) as (keyof StockRiskBreakdown)[]).map((key) => ({
    name: BREAKDOWN_LABEL[key],
    score: breakdown[key],
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.6} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.6} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={barColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
