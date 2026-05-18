import { TechnicalResumeRound, DSARound, BehaviouralRound, OOPCSRound, SystemDesignRound } from "./rounds";
import type { RoundType } from "./types";

const rounds: Record<string, RoundType> = {
  "technical-resume": new TechnicalResumeRound(),
  dsa: new DSARound(),
  behavioural: new BehaviouralRound(),
  "oop-cs": new OOPCSRound(),
  "system-design": new SystemDesignRound(),
};

export function getRoundType(id: string): RoundType {
  const round = rounds[id];
  if (!round) {
    throw new Error(`Unknown round type: ${id}`);
  }
  return round;
}

export function listRoundTypes(phase?: 1 | 2): RoundType[] {
  const all = Object.values(rounds);
  return phase ? all.filter((r) => r.phase <= phase) : all;
}
