"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { StockRecommendations } from "@/components/stock-recommendations";
import { RISK_QUESTIONNAIRE } from "@/lib/risk/questionnaire";
import { useUserRiskStore } from "@/lib/store/userRiskStore";
import type { RiskLevel } from "@/types/risk";

const LEVEL_LABEL: Record<RiskLevel, string> = {
  conservative: "保守型",
  moderate: "穩健型",
  aggressive: "積極型",
};

const LEVEL_BADGE_CLASS: Record<RiskLevel, string> = {
  conservative: "border-blue-500 text-blue-600 dark:text-blue-400",
  moderate: "border-amber-500 text-amber-600 dark:text-amber-400",
  aggressive: "border-red-500 text-red-600 dark:text-red-400",
};

export function RiskQuestionnaire() {
  const answers = useUserRiskStore((s) => s.answers);
  const result = useUserRiskStore((s) => s.result);
  const profile = useUserRiskStore((s) => s.profile);
  const setAnswer = useUserRiskStore((s) => s.setAnswer);
  const submit = useUserRiskStore((s) => s.submit);
  const reset = useUserRiskStore((s) => s.reset);

  const answeredCount = RISK_QUESTIONNAIRE.filter(
    (q) => answers[q.id] !== undefined
  ).length;
  const isComplete = answeredCount === RISK_QUESTIONNAIRE.length;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          已作答 {answeredCount} / {RISK_QUESTIONNAIRE.length} 題
        </p>
        {(answeredCount > 0 || result) && (
          <Button variant="ghost" size="sm" onClick={reset}>
            重新作答
          </Button>
        )}
      </div>

      {RISK_QUESTIONNAIRE.map((q, index) => (
        <Card key={q.id}>
          <CardHeader>
            <CardTitle>
              {index + 1}. {q.question}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={answers[q.id] ?? null}
              onValueChange={(value) => setAnswer(q.id, value as string)}
            >
              {q.options.map((option) => {
                const inputId = `${q.id}-${option.value}`;
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <RadioGroupItem value={option.value} id={inputId} />
                    <Label htmlFor={inputId} className="font-normal">
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      ))}

      <Button size="lg" disabled={!isComplete} onClick={submit}>
        計算我的風險分數
      </Button>

      {result && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>你的風險評估結果</CardTitle>
              <Badge variant="outline" className={LEVEL_BADGE_CLASS[result.level]}>
                {LEVEL_LABEL[result.level]}
              </Badge>
            </div>
            <CardDescription>
              風險承受分數：{result.score.toFixed(1)} / 100（分數越高代表能承受的風險越高）
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              可接受的個股風險分數區間：
              <span className="font-medium text-foreground">
                {" "}
                {result.acceptableStockRiskRange.min.toFixed(1)} ～{" "}
                {result.acceptableStockRiskRange.max.toFixed(1)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              個股風險分數（0-100）落在這個區間內，代表風險程度大致符合你能承受的範圍；
              往下方「查詢特定股票」或「推薦股票」查看實際比對結果。
            </p>

            <Separator />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">各題得分明細</p>
              <ul className="flex flex-col gap-1.5">
                {result.factors.map((factor) => (
                  <li
                    key={factor.name}
                    className="flex items-start justify-between gap-4 text-sm text-muted-foreground"
                  >
                    <span>{factor.description}</span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {factor.score} 分
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {result && profile && <StockRecommendations profile={profile} />}
    </div>
  );
}
