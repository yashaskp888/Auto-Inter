import { NextResponse } from 'next/server';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRandomInterviewCover } from '@/lib/utils';
import { db } from '@/firebase/admin';

function extractJsonArray(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found');
  return JSON.parse(match[0]);
}

/** Create a new interview with same role, level, techstack, question count but different questions */
export async function POST(request: Request) {
  try {
    const { sourceInterviewId, userId } = await request.json();

    if (!sourceInterviewId || !userId) {
      return NextResponse.json(
        { error: 'Missing sourceInterviewId or userId' },
        { status: 400 }
      );
    }

    const sourceDoc = await db.collection('interviews').doc(sourceInterviewId).get();
    if (!sourceDoc.exists) {
      return NextResponse.json({ error: 'Source interview not found' }, { status: 404 });
    }

    const data = sourceDoc.data()!;
    const role = data.role || 'Software Developer';
    const level = data.level || 'Mid';
    const type = data.type || 'Technical';
    const techstack = Array.isArray(data.techstack) ? data.techstack : [];
    const techstackStr = techstack.join(', ');
    const amount = Array.isArray(data.questions) ? data.questions.length : 5;

    const { text: questions } = await generateText({
      model: groq('llama-3.1-8b-instant'),
      prompt: `Prepare questions for a job interview.
The job role is: ${role}.
The job experience level is: ${level}.
The tech stack used in the job is: ${techstackStr}.
The amount of questions required is: ${amount}.
Please return only the questions without any additional text.
The questions are read by a voice agent so don't use "/" or "*" or any other special characters that may break the voice assistant.
Return the questions formatted like this:
["Question 1","Question 2","Question 3",...]`,
    });

    const interview = {
      role,
      type,
      level,
      techstack,
      questions: extractJsonArray(questions),
      userId,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection('interviews').add(interview);

    return NextResponse.json({
      success: true,
      interviewId: ref.id,
      role,
      level,
      type,
      techstack,
      questionCount: interview.questions.length,
    });
  } catch (error) {
    console.error('Retake interview error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create retake interview',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
