import { db } from "@/firebase/admin";
import { notFound } from "next/navigation";
import FeedbackReport from "@/components/FeedbackReport";

interface PageProps {
  params: Promise<{ feedbackId: string }>;
}

/** Convert Firestore data to plain JSON (fixes Timestamp/class objects for Client Components) */
function serializeForClient(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  // Firestore Timestamp (has toDate method)
  if (obj && typeof obj.toDate === "function") {
    return obj.toDate().toISOString();
  }
  // Firestore Timestamp (internal _seconds/_nanoseconds format)
  if (obj && typeof obj === "object" && "_seconds" in obj) {
    const date = new Date((obj._seconds || 0) * 1000);
    return date.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeForClient);
  }
  if (typeof obj === "object" && obj.constructor === Object) {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeForClient(value);
    }
    return serialized;
  }
  return obj;
}

export default async function FeedbackPage({ params }: PageProps) {
  const { feedbackId } = await params;

  // Get feedback from Firebase
  const feedbackDoc = await db.collection("feedback").doc(feedbackId).get();

  if (!feedbackDoc.exists) {
    notFound();
  }

  const feedback = feedbackDoc.data() as Feedback;

  // Get interview details
  let interview = null;
  if (feedback.interviewId) {
    const interviewDoc = await db
      .collection("interviews")
      .doc(feedback.interviewId)
      .get();
    if (interviewDoc.exists) {
      interview = interviewDoc.data();
    }
  }

  // Serialize Firestore Timestamps to plain objects for Client Component
  const serializedFeedback = serializeForClient(feedback) as Feedback;
  const serializedInterview = serializeForClient(interview);

  return <FeedbackReport feedback={serializedFeedback} interview={serializedInterview} />;
}
