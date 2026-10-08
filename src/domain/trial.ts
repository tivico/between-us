export interface TrialDefinition {
  id: string;
  version: string;
  title: string;
  instructions: string;
  questions: { id: string; number: number; prompt: string }[];
  options: { id: string; label: string }[];
  sources: { title: string; url: string; description: string }[];
}

export type TrialAnswers = Record<string, string>;

export function summarizeTrial(trial: TrialDefinition, answers: TrialAnswers, flagged: ReadonlySet<string>) {
  const rows = trial.questions.map((question) => {
    const option = trial.options.find((item) => item.id === answers[question.id]);
    return { ...question, answer: option?.label, flagged: flagged.has(question.id) };
  });
  return {
    rows,
    answered: rows.filter((row) => row.answer !== undefined).length,
    unanswered: rows.filter((row) => row.answer === undefined).length,
    flagged: rows.filter((row) => row.flagged).length,
  };
}
