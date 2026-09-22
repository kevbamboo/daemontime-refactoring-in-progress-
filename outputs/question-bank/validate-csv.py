import csv
import json
from pathlib import Path

base = Path(__file__).parent
with (base / 'sat_act_style_questions.csv').open(encoding='utf-8', newline='') as source:
    reader = csv.DictReader(source)
    assert reader.fieldnames == ['id', 'question', 'choices', 'answer', 'difficulty', 'short_explanation', 'long_explanation', 'source', 'type']
    rows = list(reader)
assert len(rows) == 2000
assert len({row['id'] for row in rows}) == 2000
for row in rows:
    assert row['choices'].startswith('{') and row['choices'].endswith('}')
    # Exported strings use JSON-compatible escaping inside the PG array braces.
    choices = json.loads('[' + row['choices'][1:-1] + ']')
    assert len(choices) == 4 and all(isinstance(choice, str) and choice for choice in choices)
    assert len(set(choices)) == 4
    assert 1 <= int(row['answer']) <= 4 and 1 <= int(row['difficulty']) <= 5
    assert row['type'] in ('math', 'grammar')
    assert int(row['id']) // 100000 == (1 if row['type'] == 'math' else 2)
    assert all(row.values()) and 'https://' in row['source'] and 'License:' in row['source']
print(json.dumps({'rows': len(rows), 'columns': reader.fieldnames, 'valid_four_string_arrays': len(rows)}))
