# Math and grammar practice bank

`sat_act_style_questions.csv` contains 2,000 rows: 1,000 math and 1,000 grammar questions.

This is adapted, foundational practice for skills relevant to SAT/ACT preparation, not official SAT/ACT content or a full exam-aligned question bank. GSM8K primarily contains grade-school/middle-school multistep arithmetic. BLiMP contains synthetic sentence-level grammatical contrasts. This bank does not provide full coverage of advanced algebra, trigonometry, punctuation, passage editing, or reading comprehension.

## CSV fields

- `id`: integer identifier, 100001–101000 for math and 200001–201000 for grammar.
- `question`: question prompt.
- `choices`: four strings in PostgreSQL `text[]` format, e.g. `{"First","Second","Third","Fourth"}`. Embedded quotes and backslashes are escaped, then the entire array is CSV-quoted. Supabase returns this column as a JavaScript array.
- `answer`: integer **1, 2, 3, or 4**, matching the position in `choices`.
- `difficulty`: estimated integer **1–5**, relative to this bank.
- `short_explanation` and `long_explanation`: concise answer explanation and fuller reasoning.
- `type`: exactly `math` or `grammar`.
- `source`: source name, URLs, original record IDs, license and license URL, and adaptation details. Keep `LICENSES.md` with redistributed copies.

CSV uses UTF-8 and quoted fields with embedded newlines. Its nine columns match the Supabase `questions` table. Use a proper CSV reader, not a line splitter. This file has not been imported into Supabase. Existing questions are unchanged. Check for conflicting IDs before importing. The backend now reads `choices` and `answer` from this schema.

## Sources and adaptations

### Math: GSM8K

Source: https://github.com/openai/grade-school-math

Karl Cobbe, Vineet Kosaraju, Mohammad Bavarian, Mark Chen, Heewoo Jun, Lukasz Kaiser, Matthias Plappert, Jerry Tworek, Jacob Hilton, Reiichiro Nakano, Christopher Hesse, and John Schulman (2021), *Training Verifiers to Solve Math Word Problems*.

License: MIT, copyright (c) 2021 OpenAI. See `LICENSES.md` for the required notice.

Question wording and answer keys come from the source train/test records. Source calculator markup was removed from explanations; the source solution's final line supplies the short explanation. Three numeric distractors and difficulty estimates were added. Source URLs point to original file line numbers (one-based). Selection favors a mix of ratios, percentages, rates, averages, measurement, and multistep word problems.

### Grammar: BLiMP

Source: https://github.com/alexwarstadt/blimp

Alex Warstadt, Alicia Parrish, Haokun Liu, Anhad Mohananey, Wei Peng, Sheng-Fu Wang, and Samuel R. Bowman (2020), *BLiMP: The Benchmark of Linguistic Minimal Pairs for English*, Transactions of the Association for Computational Linguistics 8, 377–392. https://doi.org/10.1162/tacl_a_00321

License: Creative Commons Attribution 4.0 International. https://creativecommons.org/licenses/by/4.0/

Each four-choice item combines four distinct source pairs from one grammatical category. One option uses its source's grammatical sentence; three use their source's ungrammatical sentence. The prompt, explanations, and difficulty estimate were added. The source text of each option is preserved. Four source URLs and IDs are listed in choice order, separated by ` | `. The source IDs retain the original zero-based `pairID`; URL line anchors are one-based.

## Difficulty and checks

Difficulty is a heuristic estimate, not an official SAT/ACT rating or an empirical measure from student performance. Math ratings increase with the number of source calculation steps; longer percentage problems receive an additional increment, capped at 5. Grammar ratings range from 1 (basic determiner agreement) to 4 (agreement across relative clauses).

Checks verify 2,000 unique prompt-and-choice combinations, required fields, four distinct options, answer index/text agreement, difficulty ranges, balanced answer positions (500 per position), source attribution, and CSV round-trip parsing. Identical grammar prompts are intentional; the answer sentences differ.

All selected math calculator annotations and the final numeric result were independently recalculated. This checks arithmetic, not every interpretation of the word problem. Grammar source labels were additionally screened with restricted agreement and irregular-verb rules; ambiguous number forms and suspect labels were excluded. Source sentences can sound semantically unusual because BLiMP is synthetic. The dataset has not received a complete expert review of every question.

Neither College Board nor ACT authored, calibrated, or endorsed this bank.
