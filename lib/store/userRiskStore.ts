import { create } from "zustand";
import { calculateUserRiskScore } from "@/lib/risk/userRiskScore";
import { RISK_QUESTIONNAIRE } from "@/lib/risk/questionnaire";
import type { UserRiskProfile, UserRiskScore } from "@/types/risk";

type PartialAnswers = Partial<Record<keyof UserRiskProfile, string>>;

interface UserRiskStore {
  answers: PartialAnswers;
  result: UserRiskScore | null;
  /** 提交當下的完整問卷作答，result 存在時必定同步存在，供推薦 API 使用 */
  profile: UserRiskProfile | null;
  setAnswer: (questionId: keyof UserRiskProfile, value: string) => void;
  submit: () => void;
  reset: () => void;
}

/** 目前作答是否已涵蓋問卷全部題目，是則轉型為完整的 UserRiskProfile */
function toCompleteProfile(answers: PartialAnswers): UserRiskProfile | null {
  const isComplete = RISK_QUESTIONNAIRE.every((q) => answers[q.id] !== undefined);
  if (!isComplete) return null;
  return answers as UserRiskProfile;
}

export const useUserRiskStore = create<UserRiskStore>((set, get) => ({
  answers: {},
  result: null,
  profile: null,
  setAnswer: (questionId, value) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: value },
      // 修改作答後，先前算出的結果就過期了，清空避免顯示跟目前作答不一致的舊分數
      result: null,
      profile: null,
    })),
  submit: () => {
    const profile = toCompleteProfile(get().answers);
    if (!profile) return;
    set({ result: calculateUserRiskScore(profile), profile });
  },
  reset: () => set({ answers: {}, result: null, profile: null }),
}));
