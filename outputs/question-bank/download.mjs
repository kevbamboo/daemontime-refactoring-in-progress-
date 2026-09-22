import fs from 'node:fs/promises';
const dir = new URL('./sources/', import.meta.url);
await fs.mkdir(dir, { recursive: true });
const files = {
  'gsm8k-train.jsonl': 'https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/train.jsonl',
  'gsm8k-test.jsonl': 'https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl',
  'gsm8k-LICENSE.txt': 'https://raw.githubusercontent.com/openai/grade-school-math/master/LICENSE',
  'blimp-README.md': 'https://raw.githubusercontent.com/alexwarstadt/blimp/master/README.md',
  'CC-BY-4.0.txt': 'https://creativecommons.org/licenses/by/4.0/legalcode.txt',
};
for (const topic of ['regular_plural_subject_verb_agreement_1', 'regular_plural_subject_verb_agreement_2', 'irregular_plural_subject_verb_agreement_1', 'irregular_plural_subject_verb_agreement_2', 'distractor_agreement_relational_noun', 'distractor_agreement_relative_clause', 'determiner_noun_agreement_1', 'determiner_noun_agreement_2', 'determiner_noun_agreement_with_adjective_1', 'determiner_noun_agreement_with_adj_2', 'anaphor_number_agreement', 'irregular_past_participle_verbs']) {
  files[`blimp-${topic}.jsonl`] = `https://raw.githubusercontent.com/alexwarstadt/blimp/master/data/${topic}.jsonl`;
}
for (const [name, url] of Object.entries(files)) {
  let response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  let text = await response.text();
  if (text.startsWith('version https://git-lfs.github.com/spec')) {
    response = await fetch(url.replace('raw.githubusercontent.com', 'media.githubusercontent.com/media'));
    if (!response.ok) throw new Error(`${name}: LFS ${response.status}`);
    text = await response.text();
  }
  await fs.writeFile(new URL(name, dir), text);
  console.log(`${name}: ${text.length} characters`);
}
