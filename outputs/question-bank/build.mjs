import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Workbook } from '@oai/artifact-tool';

const base = new URL('./', import.meta.url);
const read = name => fs.readFile(new URL(`sources/${name}`, base), 'utf8');
const lines = text => text.trim().split(/\r?\n/).map(JSON.parse);
const clean = text => text.replace(/\s+/g, ' ').trim();
const number = n => String(Number(n.toFixed(6)));
const digest = s => createHash('sha256').update(s).digest('hex');
const rows = [];
const evidence = [];
const excluded = {};
const reject = reason => { excluded[reason] = (excluded[reason] || 0) + 1; };

// Parse arithmetic annotations as numbers/operators only. Never evaluate source
// text as JavaScript, Python, or shell code.
function calculate(expression) {
  const input = expression.replace(/,/g, '').replace(/\s/g, '');
  const tokens = input.match(/\d*\.?\d+|[()+*/-]/g) || [];
  if (tokens.join('') !== input || tokens.length > 150) throw new Error('Unsupported arithmetic');
  let pos = 0;
  const atom = () => {
    const token = tokens[pos++];
    if (token === '-') return -atom();
    if (token === '+') return atom();
    if (token === '(') {
      const value = sum();
      if (tokens[pos++] !== ')') throw new Error('Missing parenthesis');
      return value;
    }
    if (!/^\d*\.?\d+$/.test(token || '')) throw new Error('Invalid number');
    return Number(token);
  };
  const product = () => {
    let value = atom();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const right = atom();
      value = op === '*' ? value * right : value / right;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const right = product();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  if (pos !== tokens.length || !Number.isFinite(value)) throw new Error('Invalid calculation');
  return value;
}
const equal = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

function mathTopic(q) {
  if (/percent|percentage|%|discount/i.test(q)) return 'percentages';
  if (/area|perimeter|rectangle|square feet|square meters|triangle|circumference|volume/i.test(q)) return 'measurement and geometry';
  if (/average|mean |median/i.test(q)) return 'averages and data';
  if (/speed|miles per|kilometers per|mph|per hour|per minute|per second|gallons per/i.test(q)) return 'rates and unit conversion';
  if (/ratio|fraction|one.third|two.third|one.fourth|three.fourth|half|twice|double/i.test(q)) return 'ratios and proportions';
  return 'multistep word questions';
}

const mathCandidates = [];
const seenQuestions = new Set();
for (const split of ['train', 'test']) {
  const source = lines(await read(`gsm8k-${split}.jsonl`));
  for (const [index, item] of source.entries()) {
    const match = item.answer.match(/####\s*(-?[\d,]+(?:\.\d+)?)\s*$/);
    if (!match) { reject('math_non_numeric_answer'); continue; }
    const answer = Number(match[1].replace(/,/g, ''));
    const checks = [...item.answer.matchAll(/<<([^<>]+)>>/g)];
    if (checks.length < 3 || checks.length > 9 || answer <= 0) { reject('math_scope_or_step_count'); continue; }
    let results;
    try {
      results = checks.map(m => {
        const [expression, stated, extra] = m[1].split('=');
        if (extra !== undefined || !equal(calculate(expression), calculate(stated))) throw new Error('Calculation mismatch');
        return calculate(stated);
      });
      if (!equal(results.at(-1), answer)) throw new Error('Final result mismatch');
    } catch { reject('math_unverified_arithmetic'); continue; }
    const q = clean(item.question);
    if (seenQuestions.has(q.toLowerCase())) { reject('math_duplicate'); continue; }
    if (/\b(kill|dead|death|cigarette|beer|wine|alcohol|gun|gambl|suicide)\w*/i.test(q)) { reject('math_content_filter'); continue; }
    seenQuestions.add(q.toLowerCase());
    const solutionLines = item.answer.replace(/####[\s\S]*$/, '').replace(/<<[^<>]*>>/g, '').trim().split(/\r?\n/).map(clean).filter(Boolean);
    if (solutionLines.length < 3) { reject('math_short_solution'); continue; }
    mathCandidates.push({ q, answer, results, solutionLines, index, split, topic: mathTopic(q), checks: checks.length });
  }
}

// Round-robin across available topics so generic shopping arithmetic does not
// crowd out percentages, rate questions, averages, or measurement.
const groups = new Map();
for (const q of mathCandidates.sort((a,b) => digest(a.q).localeCompare(digest(b.q)))) {
  if (!groups.has(q.topic)) groups.set(q.topic, []);
  groups.get(q.topic).push(q);
}
const selectedMath = [];
while (selectedMath.length < 1000) {
  let progress = false;
  for (const group of groups.values()) if (group.length && selectedMath.length < 1000) {
    selectedMath.push(group.shift()); progress = true;
  }
  assert(progress, 'Insufficient verified math candidates');
}

for (const [i, q] of selectedMath.entries()) {
  const correct = number(q.answer);
  const wrong = [];
  const add = n => {
    const value = number(n);
    if (n > 0 && value !== correct && !wrong.includes(value)) wrong.push(value);
  };
  const step = Number.isInteger(q.answer) ? Math.max(1, Math.round(q.answer * 0.1)) : Math.max(0.01, q.answer * 0.1);
  // Nearby errors plus an intermediate result produce numeric distractors.
  const candidates = [q.answer + step, q.answer - step, ...q.results.slice(0, -1).reverse(), q.answer * 2, q.answer / 2, q.answer + 1];
  for (const n of candidates) if (n <= q.answer * 5 && n >= q.answer / 5) add(n);
  for (let k = 2; wrong.length < 3; k++) add(q.answer + k * step);
  const choices = wrong.slice(0, 3);
  const answerIndex = i % 4;
  choices.splice(answerIndex, 0, correct);
  const difficulty = Math.min(5, Math.max(1, q.checks - 2) + (q.topic === 'percentages' && q.checks >= 4 ? 1 : 0));
  const sourceUrl = `https://github.com/openai/grade-school-math/blob/master/grade_school_math/data/${q.split}.jsonl#L${q.index + 1}`;
  rows.push({
    id: `math-${String(i + 1).padStart(4, '0')}`, question: q.q,
    choice_1: choices[0], choice_2: choices[1], choice_3: choices[2], choice_4: choices[3],
    correct_answer: answerIndex + 1, correct_answer_text: correct, difficulty,
    short_explanation: q.solutionLines.at(-1), long_explanation: q.solutionLines.join('\n'),
    type: 'math', topic: q.topic, source_name: 'GSM8K (OpenAI, 2021)', source_url: sourceUrl,
    source_id: `gsm8k:${q.split}:${q.index + 1}`, license: 'MIT',
    license_url: 'https://github.com/openai/grade-school-math/blob/master/LICENSE',
    modifications: 'Added three numeric distractors and a 1-5 difficulty estimate; removed calculator markup; extracted short explanation from source solution.',
    difficulty_basis: 'Estimated within this practice bank from calculation count; not an SAT/ACT-calibrated rating.',
    answer_validation: 'Source answer; all embedded arithmetic and final result checked. Word-question interpretation not independently re-solved.',
  });
  evidence.push({ id: rows.at(-1).id, source: sourceUrl, checks: q.checks });
}

const grammarFiles = (await fs.readdir(new URL('./sources/', base))).filter(f => /^blimp-.*\.jsonl$/.test(f) && !f.includes('anaphor'));
const grammarGroups = [];
const excludedWords = /\b(kill|murder|die|dead|death|naked|sex|rape|suicide|guns?|rifle|pistol|terrorist|racist|porn|molest|abuse|torture|assault|fetus|fetuses)\w*\b/i;
const unusualNouns = /\b(legislatures|Borgias|radii|foci|stimuli|phenomena|fungi|algae|offspring|species|fish|sheep|deer|aircraft|series|headquarters|committee|staff)\b/i;
const usedSentences = new Set();
const singularNouns = new Set(['news', 'glass', 'dress', 'bus', 'class', 'walrus', 'cactus', 'fungus', 'octopus', 'status', 'hypothesis', 'analysis', 'crisis']);
const irregularPlurals = new Set(['children', 'men', 'women', 'people', 'mice', 'geese', 'teeth', 'feet', 'oxen']);
function nounNumber(phrase) {
  let s = phrase.trim().replace(/[.,]$/g, '');
  if (/\b(?:Clintons|Borgias|Impressionists|pants|clothes|scissors|police|trousers)\b/i.test(s)) return null;
  s = s.replace(/^a lot of /i, '');
  s = s.split(/\s+(?:who|that|which|of|about|with|from)\s+/i)[0];
  const words = s.split(/\s+/);
  const last = words.at(-1).toLowerCase();
  if (irregularPlurals.has(last)) return 'plural';
  if (/^(a|an|each|every|this|that)\s/i.test(s)) return 'singular';
  if (/^(these|those|many|several|both|most|all)\s/i.test(s)) return 'plural';
  if (words.length === 1 && /^[A-Z][a-z]+$/.test(s)) return 'singular';
  if (singularNouns.has(last)) return 'singular';
  return /s$/.test(last) ? 'plural' : 'singular';
}
function verbNumber(word) {
  const w = word.toLowerCase().split(' ')[0];
  if (/^(is|was|has|does)(n't)?$/.test(w)) return 'singular';
  if (/^(are|were|have|do)(n't)?$/.test(w)) return 'plural';
  if (/^(can|could|will|would|shall|should|must|may|might|had|did)(n't)?$/.test(w) || /ed$/.test(w)) return null;
  if (['pass','kiss','miss','dress','discuss','express','possess','address','cross'].includes(w)) return 'plural';
  return /s$/.test(w) ? 'singular' : 'plural';
}
const participles = new Map(Object.entries({ wore:'worn', hid:'hidden', went:'gone', ate:'eaten', saw:'seen', gave:'given', took:'taken', broke:'broken', spoke:'spoken', wrote:'written', drove:'driven', rode:'ridden', rose:'risen', fell:'fallen', chose:'chosen', stole:'stolen', forgot:'forgotten', froze:'frozen', flew:'flown', grew:'grown', knew:'known', threw:'thrown', blew:'blown', drew:'drawn', drank:'drunk', sang:'sung', rang:'rung', swam:'swum', began:'begun', ran:'run', came:'come', shook:'shaken', tore:'torn', woke:'woken', bit:'bitten', did:'done', lay:'lain' }));
function independentlyCheckGrammar(q) {
  if (q.UID.includes('past_participle')) {
    const g = q.one_prefix_word_good.split(' ')[0];
    const b = q.one_prefix_word_bad.split(' ')[0];
    return participles.get(g) === b;
  }
  if (q.UID.includes('determiner')) {
    if (q.one_prefix_method) {
      const determiner = [...q.one_prefix_prefix.matchAll(/\b(this|that|these|those)\b/gi)].at(-1)?.[1].toLowerCase();
      if (!determiner) return false;
      const expected = ['this','that'].includes(determiner) ? 'singular' : 'plural';
      return nounNumber(q.one_prefix_word_good) === expected && nounNumber(q.one_prefix_word_bad) !== expected;
    }
    const goodDet = [...q.two_prefix_prefix_good.matchAll(/\b(this|that|these|those)\b/gi)].at(-1)?.[1].toLowerCase();
    const badDet = [...q.two_prefix_prefix_bad.matchAll(/\b(this|that|these|those)\b/gi)].at(-1)?.[1].toLowerCase();
    const expected = nounNumber(q.two_prefix_word);
    const detNumber = d => ['this','that'].includes(d) ? 'singular' : 'plural';
    return goodDet && badDet && expected && detNumber(goodDet) === expected && detNumber(badDet) !== expected;
  }
  if (q.one_prefix_method) {
    const subject = nounNumber(q.one_prefix_prefix);
    const goodVerb = verbNumber(q.one_prefix_word_good);
    const badVerb = verbNumber(q.one_prefix_word_bad);
    return subject && goodVerb && badVerb && subject === goodVerb && subject !== badVerb;
  }
  const goodSubject = nounNumber(q.two_prefix_prefix_good);
  const badSubject = nounNumber(q.two_prefix_prefix_bad);
  const verb = verbNumber(q.two_prefix_word);
  return goodSubject && badSubject && verb && goodSubject === verb && badSubject !== verb;
}
for (const filename of grammarFiles.sort()) {
  const candidates = lines(await read(filename)).map((q, index) => ({ ...q, line: index + 1 })).filter(q => {
    const words = q.sentence_good.split(/\s+/).length;
    if (words < 4 || words > 18 || excludedWords.test(q.sentence_good) || unusualNouns.test(q.sentence_good)) return false;
    if (q.sentence_good === q.sentence_bad) return false;
    if (!independentlyCheckGrammar(q)) { reject('grammar_rule_check'); return false; }
    // Avoid quoted speech/headline readings and plural/singular ambiguous forms.
    if (/[":;?!]/.test(q.sentence_good) || /\b(moose|bison|salmon|trout|swine|you|they)\b/i.test(q.sentence_good)) return false;
    if (usedSentences.has(q.sentence_good.toLowerCase()) || usedSentences.has(q.sentence_bad.toLowerCase())) return false;
    usedSentences.add(q.sentence_good.toLowerCase()); usedSentences.add(q.sentence_bad.toLowerCase());
    return true;
  }).sort((a,b) => digest(a.sentence_good).localeCompare(digest(b.sentence_good)));
  grammarGroups.push({ filename, candidates });
}

function ruleFor(uid) {
  if (uid.includes('determiner')) return {
    topic: 'determiner-noun agreement', difficulty: uid.includes('adj') ? 2 : 1,
    rule: 'This and that take singular nouns; these and those take plural nouns. An intervening adjective does not change that agreement.',
  };
  if (uid.includes('past_participle')) return {
    topic: 'irregular verb forms', difficulty: 2,
    rule: 'A simple-past main verb uses its past-tense form. A distinct past participle needs an appropriate auxiliary, such as has or had, in this construction.',
  };
  if (uid.includes('relative_clause')) return {
    topic: 'subject-verb agreement across a relative clause', difficulty: 4,
    rule: 'The main verb agrees with the head of its subject, not a noun inside an intervening relative clause. Identify the main subject before checking the verb.',
  };
  if (uid.includes('relational_noun')) return {
    topic: 'subject-verb agreement across a prepositional phrase', difficulty: 3,
    rule: 'The main verb agrees with the head noun of the subject. A noun inside a following prepositional phrase does not determine the main verb form.',
  };
  return {
    topic: uid.includes('irregular_plural') ? 'subject-verb agreement with irregular plurals' : 'subject-verb agreement',
    difficulty: uid.includes('irregular_plural') ? 3 : 2,
    rule: 'The subject and finite verb must agree in number: a singular subject takes a singular verb form, and a plural subject takes a plural verb form.',
  };
}
function changedPhrase(good, bad) {
  const g = good.split(' '), b = bad.split(' ');
  let start = 0, endG = g.length, endB = b.length;
  while (start < Math.min(g.length,b.length) && g[start] === b[start]) start++;
  while (endG > start && endB > start && g[endG - 1] === b[endB - 1]) { endG--; endB--; }
  return { good: g.slice(start, endG).join(' ').replace(/\.$/, ''), bad: b.slice(start,endB).join(' ').replace(/\.$/, '') };
}
let grammarCount = 0;
while (grammarCount < 1000) {
  let progress = false;
  for (const group of grammarGroups) {
    if (group.candidates.length < 4 || grammarCount >= 1000) continue;
    const pairs = group.candidates.splice(0, 4);
    const correctPosition = grammarCount % 4;
    const options = pairs.map((pair, i) => i === correctPosition ? pair.sentence_good : pair.sentence_bad);
    const rule = ruleFor(pairs[0].UID);
    const long = [rule.rule, ...pairs.map((pair, i) => {
      if (i === correctPosition) return `Choice ${i + 1} is correct: "${pair.sentence_good}"`;
      const diff = changedPhrase(pair.sentence_good, pair.sentence_bad);
      return `Choice ${i + 1} is incorrect. Replace "${diff.bad}" with "${diff.good}": "${pair.sentence_good}"`;
    })].join('\n');
    const url = `https://github.com/alexwarstadt/blimp/blob/master/data/${pairs[0].UID}.jsonl`;
    const sources = pairs.map(pair => `${url}#L${pair.line}`);
    rows.push({
      id: `grammar-${String(grammarCount + 1).padStart(4, '0')}`,
      question: 'Which sentence conforms to the conventions of standard written English?',
      choice_1: options[0], choice_2: options[1], choice_3: options[2], choice_4: options[3],
      correct_answer: correctPosition + 1, correct_answer_text: options[correctPosition],
      difficulty: rule.difficulty,
      short_explanation: `Choice ${correctPosition + 1} has correct ${rule.topic}. ${rule.rule}`,
      long_explanation: long, type: 'grammar', topic: rule.topic,
      source_name: 'BLiMP (Warstadt et al., 2020)', source_url: sources.join(' | '),
      source_id: pairs.map(pair => `blimp:${pair.UID}:${pair.pairID}`).join(' | '),
      license: 'CC-BY-4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/',
      modifications: 'Combined four source minimal pairs into one four-choice item; added prompt, explanations and estimated difficulty. Choices retain source wording.',
      difficulty_basis: 'Estimated from the grammar construction; not an SAT/ACT-calibrated rating.',
      answer_validation: 'Source good/bad labels cross-checked with restricted agreement/verb-form rules; corrections drawn from the paired grammatical sentences. Not a complete linguistic proof.',
    });
    evidence.push({ id: rows.at(-1).id, sources, source_pairs: pairs });
    grammarCount++; progress = true;
  }
  assert(progress, 'Insufficient distinct grammar sentences');
}

assert.equal(rows.length, 2000);
const signatures = new Set();
for (const row of rows) {
  const options = [1,2,3,4].map(i => row[`choice_${i}`]);
  assert.equal(new Set(options).size, 4, row.id);
  assert.equal(options[row.correct_answer - 1], row.correct_answer_text, row.id);
  assert(Number.isInteger(row.difficulty) && row.difficulty >= 1 && row.difficulty <= 5);
  assert(row.long_explanation.length > row.short_explanation.length, row.id);
  for (const value of Object.values(row)) assert.notEqual(String(value).trim(), '', row.id);
  const signature = digest([row.question, ...options].join('\n'));
  assert(!signatures.has(signature), row.id); signatures.add(signature);
}
const headers = ['id', 'question', 'choices', 'answer', 'difficulty', 'short_explanation', 'long_explanation', 'source', 'type'];
rows.sort((a,b) => digest(`csv:${a.id}`).localeCompare(digest(`csv:${b.id}`)));
// Supabase uses integer IDs and PostgreSQL text[] for choices.
const pgArray = values => `{${values.map(value => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
const exportRows = rows.map(row => ({
  id: (row.type === 'math' ? 100000 : 200000) + Number(row.id.split('-').at(-1)),
  question: row.question,
  choices: pgArray([row.choice_1, row.choice_2, row.choice_3, row.choice_4]),
  answer: row.correct_answer, difficulty: row.difficulty,
  short_explanation: row.short_explanation, long_explanation: row.long_explanation,
  source: `${row.source_name}\n${row.source_url}\nSource IDs: ${row.source_id}\nLicense: ${row.license} (${row.license_url})\n${row.modifications}`,
  type: row.type,
}));
assert.equal(new Set(exportRows.map(row => row.id)).size, 2000);
const matrix = [headers, ...exportRows.map(row => headers.map(header => row[header]))];
// Author the tabular artifact through the spreadsheet API; CSV serialization
// preserves plain text and does not add any workbook-only presentation rows.
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Questions');
const range = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
range.values = matrix;
workbook.recalculate();
const authored = range.values;
assert.equal(authored.length, 2001);
const quote = value => `"${String(value).replace(/"/g, '""')}"`;
const csv = authored.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
await fs.writeFile(new URL('sat_act_style_questions.csv', base), csv, 'utf8');
// Inspect a compact view without changing the CSV's headers or data.
sheet.getRange('A1:E4').format.font = { name: 'Arial', size: 10 };
sheet.getRange('A1:E1').format.fill = '#26354a';
sheet.getRange('A1:E1').format.font = { name: 'Arial', size: 10, bold: true, color: '#ffffff' };
sheet.getRange('A1:E4').format.wrapText = true;
sheet.getRange('A1:E4').format.verticalAlignment = 'top';
sheet.getRange('A1:A4').format.columnWidth = 15;
sheet.getRange('B1:B4').format.columnWidth = 54;
sheet.getRange('C1:C4').format.columnWidth = 100;
sheet.getRange('D1:E4').format.columnWidth = 14;
sheet.getRange('A1:E1').format.rowHeight = 34;
sheet.getRange('A2:E4').format.rowHeight = 220;
workbook.recalculate();
const preview = await workbook.render({ sheetName: 'Questions', range: 'A1:E4', scale: 1, format: 'png' });
await fs.writeFile(new URL('preview.png', base), new Uint8Array(await preview.arrayBuffer()));
await fs.writeFile(new URL('validation-evidence.json', base), JSON.stringify(evidence, null, 2));
const counts = key => Object.fromEntries([...new Set(rows.map(r => r[key]))].map(k => [k, rows.filter(r => r[key] === k).length]));
const report = { rows: rows.length, type: counts('type'), difficulty: counts('difficulty'), answer_position: counts('correct_answer'), topics: counts('topic'), math_candidates: mathCandidates.length, exclusions: excluded, checks: 'Complete fields; unique items; four distinct options; valid answer indexes; answer text matches; 1-5 difficulty; math annotation arithmetic and final result; grammar source labels.' };
await fs.writeFile(new URL('validation-report.json', base), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
