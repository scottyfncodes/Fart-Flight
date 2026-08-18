import { GRADES } from "./config.js";

export function getGradeForMeters(meters) {
  let cur = GRADES[0];
  for (const g of GRADES) if (meters >= g.meters) cur = g;
  return cur;
}

export function getGradeIndex(code) {
  return GRADES.findIndex((g) => g.code === code);
}

export function isHigherGrade(codeA, codeB) {
  return getGradeIndex(codeA) > getGradeIndex(codeB);
}
