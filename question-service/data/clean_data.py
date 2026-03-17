import csv
import json 
from collections import defaultdict

topic_map = {
    'Array' : 'Arrays',
    'Sort' : 'Sorting',
    'String' : 'Strings',
    'Hash Table' : 'Hash Tables',
    'Linked List' : 'Linked List', 
    'Recursion' : 'Recursion', 
    'Tree' : 'Trees', 
    'Graph' : 'Graphs', 
    'Heap' : 'Heaps', 
    'Trie' : 'Tries',
}

MAX_PER_BUCKET = 10

buckets = defaultdict(lambda: defaultdict(list))

with open('question_dataset.csv') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Sort the rows by descending rating order before bucketing
# This ensures that when bucketing the first 10, the highest rated qns are selected first 
rows.sort(key=lambda x: float(x['rating'] if x['rating'] else 0), reverse=True)

for row in rows:
    if row['is_premium'] == '1':
        continue #don't use the question
    if not row['related_topics'] or not row['description']:
        continue

    difficulty = row['difficulty'].lower()
    if difficulty not in ('easy', 'medium', 'hard'):
        continue

    csv_topics = [t.strip() for t in row['related_topics'].split(',')]
    mapped_topics = list(set(
        topic_map[t] for t in csv_topics if t in topic_map
    ))

    if not mapped_topics:
        continue

    question = {
        'title': row['title'],
        'description': row['description'].strip(),
        'difficulty': difficulty,
        'topics': mapped_topics
    }

    for topic in mapped_topics:
        if len(buckets[topic][difficulty]) < MAX_PER_BUCKET:
            buckets[topic][difficulty].append(question)

output = {
    'topics': sorted(list(topic_map.values())),
    'questions': []
}

# Prevent Duplication of questions
seen_titles = set()
for topic in buckets:
    for difficulty in buckets[topic]:
        for q in buckets[topic][difficulty]:
            if q['title'] not in seen_titles:
                output['questions'].append(q)
                seen_titles.add(q['title'])

with open('seed_data.json', 'w') as f:
    json.dump(output, f, indent=2)

print('Done! seed_data.json created')
print(f'Topics: {len(output["topics"])}')
print(f'Questions: {len(output["questions"])}')