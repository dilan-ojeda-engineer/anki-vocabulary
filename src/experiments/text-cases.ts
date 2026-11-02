/** Synthetic evaluation inputs, version 0.1; expectations remain human-reviewable. */
export const textCases = [
  { id: 'P01', target: 'akward', context: 'I felt awkward asking for help.' },
  {
    id: 'P02',
    target: 'draining',
    context: 'Back-to-back meetings can be draining.',
  },
  { id: 'P03', target: 'went', context: 'I went to the office yesterday.' },
  {
    id: 'P04',
    target: 'put off',
    context: "Let's not put off this conversation.",
  },
  { id: 'P05', target: 'fuel', context: 'These rumors fuel the argument.' },
  { id: 'Q01', target: 'bringing', context: 'Thanks for bringing your notes.' },
  { id: 'Q02', target: 'stuck', context: "I'm stuck on this problem." },
  { id: 'Q03', target: 'wash', context: 'I need to wash my jacket.' },
  { id: 'Q04', target: 'go after', context: 'go after your dreams' },
  {
    id: 'Q05',
    target: 'circle back',
    context: "Let's circle back to this after lunch.",
  },
  {
    id: 'Q06',
    target: 'bank',
    context: 'I need to deposit this check at the bank.',
  },
  { id: 'Q07', target: 'bank', context: 'We sat on the river bank.' },
  { id: 'Q08', target: 'forsooth', context: null },
] as const;
