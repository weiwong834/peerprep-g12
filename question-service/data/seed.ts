import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // {db: { schema: 'questionservice'}}
);

interface Question {
    title: string;
    description: string;
    difficulty: string;
    topics: string[]
}

interface SeedData {
    topics: string[];
    questions: Question[];
}

async function seed() {
    const seedPath = path.join(__dirname, 'seed_data.json');
    const raw = fs.readFileSync(seedPath, 'utf-8');
    const data: SeedData = JSON.parse(raw);

    // Inserting topics
    console.log('Inserting topics...');
    const topicRows = data.topics.map(name => ({ name, is_empty: true}));

    const { error: topicError } = await supabase
        .schema('questionservice')
        .from('topics')
        .upsert(topicRows, { onConflict: 'name' });
    
    if (topicError) {
        console.error('Failed to insert topics:', topicError.message);
        process.exit(1);
    }
    console.log(`${data.topics.length} topics inserted`);

    // Inserting questions and question_topics
    console.log('Inserting questions...');
    let successCount = 0;
    let failCount = 0;

    for (const q of data.questions) {
        const { data: inserted, error: qError } = await supabase
            .schema('questionservice')
            .from('questions')
            .insert({
                title: q.title,
                description: q.description,
                difficulty: q.difficulty,
                availability_status: 'available'
            })
            .select('id')
            .single();
        
        if (qError || !inserted) {
            console.error(`Failed to insert "${q.title}":`, qError?.message);
            failCount++;
            continue;
        }

        //question_topic insertion 
        const topicLinks = q.topics.map(topic => ({
            question_id: inserted.id,
            topic
        }));

        const { error: linkError } = await supabase
            .schema('questionservice')
            .from('question_topics')
            .insert(topicLinks);
        
        if (linkError) {
            console.error(`Failed to link topics for "${q.title}":`, linkError.message);
            failCount++;
            continue;
        }

        successCount++;
    }

    console.log(`${successCount} questions inserted`);
    if (failCount > 0) console.log(`${failCount} questions failed`);
    console.log('Seeding complete!');
}

seed();