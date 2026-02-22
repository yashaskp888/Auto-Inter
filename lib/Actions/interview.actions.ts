'use server';

import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { db } from '@/firebase/admin';

export interface RecentInterview {
  id: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  questions: string[];
  questionCount: number;
  userId: string;
  createdAt: string;
  feedbackId?: string | null;
  hasFeedback: boolean;
  /** When true, this card is for "Take An Interview" – show "You haven't taken this yet" and Take button */
  notTakenByMe?: boolean;
  /** Sample score from another user's attempt (for notTakenByMe cards) */
  sampleScore?: number | null;
}

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Convert sayableId "3184" to "three one eight four" for voice-stored lookups */
function sayableIdToWords(sayableId: string): string {
  if (!sayableId || sayableId.length !== 4) return '';
  return sayableId
    .split('')
    .map((c) => (DIGIT_WORDS[parseInt(c, 10)] ?? c))
    .join(' ');
}

function toRecentInterview(
  doc: DocumentSnapshot,
  feedbackId: string | null,
  extra?: { notTakenByMe?: boolean; sampleScore?: number | null }
): RecentInterview {
  const data = doc.data()!;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  return {
    id: doc.id,
    role: data.role || 'Interview',
    level: data.level || '',
    type: data.type || 'Technical',
    techstack: Array.isArray(data.techstack) ? data.techstack : [],
    questions,
    questionCount: questions.length,
    userId: data.userId || '',
    createdAt: data.createdAt || new Date().toISOString(),
    feedbackId,
    hasFeedback: !!feedbackId,
    ...extra,
  };
}

/** Fetch recent interviews for a user. Uses feedback first (reliable - uses auth userId),
 * then falls back to generated interviews by userId/email/sayableId (agent may have stored different values). */
export async function getRecentInterviews(
  userId: string,
  limit = 10,
  email?: string,
  sayableId?: string
): Promise<RecentInterview[]> {
  const seen = new Set<string>();
  const results: { doc: DocumentSnapshot; feedbackId: string | null }[] = [];

  // 1. Feedback-first: find interviews from user's feedback (most reliable)
  const feedbackSnap = await db
    .collection('feedback')
    .where('userId', '==', userId)
    .get();

  for (const fbDoc of feedbackSnap.docs) {
    const fbData = fbDoc.data();
    let genId: string | null = fbData.generatedInterviewId || null;

    if (!genId && fbData.interviewId) {
      const sessionDoc = await db.collection('interviews').doc(fbData.interviewId).get();
      genId = sessionDoc.exists ? (sessionDoc.data()?.generatedInterviewId as string) || null : null;
    }

    if (genId && !seen.has(genId)) {
      const genDoc = await db.collection('interviews').doc(genId).get();
      if (genDoc.exists) {
        const data = genDoc.data()!;
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          seen.add(genId);
          results.push({ doc: genDoc, feedbackId: fbDoc.id });
        }
      }
    }
  }

  // 2. Fallback: query by userId, sayableId (and variants the agent might store), email
  const userIdsToTry = [userId];
  if (sayableId) {
    userIdsToTry.push(sayableId);
    if (sayableId.length === 4) {
      userIdsToTry.push(sayableId.split('').join(' '));
      userIdsToTry.push(sayableIdToWords(sayableId));
    }
  }
  if (email) userIdsToTry.push(email);

  const myIdentifiers = new Set<string>([userId, ...userIdsToTry].filter(Boolean));
  if (sayableId && sayableId.length === 4) {
    myIdentifiers.add(sayableId.split('').join(' '));
    myIdentifiers.add(sayableIdToWords(sayableId));
  }

  const tried = new Set<string>();
  for (const uid of userIdsToTry) {
    if (!uid || tried.has(uid)) continue;
    tried.add(uid);
    const snap = await db.collection('interviews').where('userId', '==', uid).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!Array.isArray(data.questions) || data.questions.length === 0) continue;
      if (seen.has(doc.id)) continue;
      const storedUserId = (data.userId ?? '').toString().trim();
      if (!myIdentifiers.has(storedUserId)) continue;
      seen.add(doc.id);

      const fb = feedbackSnap.docs.find(
        (d) => d.data().generatedInterviewId === doc.id
      );
      results.push({ doc, feedbackId: fb ? fb.id : null });
    }
  }

  results.sort((a, b) => {
    const aT = a.doc.data()?.createdAt || '';
    const bT = b.doc.data()?.createdAt || '';
    return bT.localeCompare(aT);
  });

  // 3. Link feedback by time for interviews that have no feedback yet (e.g. old sessions without generatedInterviewId)
  const assignedFeedbackIds = new Set(
    results.filter((r) => r.feedbackId).map((r) => r.feedbackId as string)
  );
  const unassignedFeedback = feedbackSnap.docs.filter(
    (d) => !assignedFeedbackIds.has(d.id)
  );

  for (const r of results) {
    if (r.feedbackId) continue;
    const interviewCreated = r.doc.data()?.createdAt || '';
    if (!interviewCreated) continue;
    const interviewTime = new Date(interviewCreated).getTime();
    let best: { id: string } | null = null;
    let bestDiff = Infinity;
    for (const fbDoc of unassignedFeedback) {
      if (assignedFeedbackIds.has(fbDoc.id)) continue;
      const fbData = fbDoc.data();
      const fbCreated = fbData.createdAt;
      const fbTime =
        typeof fbCreated === 'string'
          ? new Date(fbCreated).getTime()
          : (fbCreated as { toMillis?: () => number })?.toMillis?.() ?? new Date(String(fbCreated)).getTime();
      const diff = fbTime - interviewTime;
      if (diff >= 0 && diff <= 60 * 60 * 1000 && diff < bestDiff) {
        bestDiff = diff;
        best = { id: fbDoc.id };
      }
    }
    if (best) {
      r.feedbackId = best.id;
      assignedFeedbackIds.add(best.id);
    }
  }

  return results.slice(0, limit).map(({ doc, feedbackId }) =>
    toRecentInterview(doc, feedbackId)
  );
}

/** Interviews created by others that this user has NOT taken. For "Take An Interview" section. */
export async function getInterviewsNotTakenByUser(
  excludeInterviewIds: string[],
  limit = 10
): Promise<RecentInterview[]> {
  const excludeSet = new Set(excludeInterviewIds);
  const snap = await db.collection('interviews').limit(120).get();

  const candidates = snap.docs
    .filter((d) => {
      const data = d.data();
      return (
        Array.isArray(data.questions) &&
        data.questions.length > 0 &&
        !excludeSet.has(d.id)
      );
    })
    .sort((a, b) => {
      const aT = a.data().createdAt || '';
      const bT = b.data().createdAt || '';
      return bT.localeCompare(aT);
    })
    .slice(0, limit);

  if (candidates.length === 0) return [];

  const genIds = candidates.map((d) => d.id);
  const feedbackSnap = await db
    .collection('feedback')
    .where('generatedInterviewId', 'in', genIds.slice(0, 10))
    .get();

  const scoreByGenId = new Map<string, number>();
  feedbackSnap.docs.forEach((d) => {
    const gid = d.data().generatedInterviewId;
    const score = d.data().totalScore;
    if (gid != null && typeof score === 'number' && !scoreByGenId.has(gid)) {
      scoreByGenId.set(gid, score);
    }
  });

  return candidates.map((doc) => {
    const data = doc.data();
    return toRecentInterview(doc, null, {
      notTakenByMe: true,
      sampleScore: scoreByGenId.get(doc.id) ?? null,
    });
  });
}
