import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/Actions/auth.actions";
import { db } from "@/firebase/admin";

/** GET: Returns your user ids and recent interview userIds in DB (for debugging why interviews don't show) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const recent = await db
    .collection("interviews")
    .get();

  const withQuestions = recent.docs
    .filter((d) => {
      const data = d.data();
      return Array.isArray(data.questions) && data.questions.length > 0;
    })
    .sort((a, b) => {
      const aT = a.data().createdAt || "";
      const bT = b.data().createdAt || "";
      return bT.localeCompare(aT);
    })
    .slice(0, 20)
    .map((d) => ({ id: d.id, userId: d.data().userId, createdAt: d.data().createdAt }));

  return NextResponse.json({
    yourSayableId: user.sayableId,
    yourEmail: user.email,
    yourFirebaseId: user.id,
    message:
      "When the AI asks for user ID, say your 4-digit code: " +
      (user.sayableId ? user.sayableId.split("").join(" ") : "—"),
    recentInterviewUserIds: withQuestions.map((x) => x.userId),
    recentInterviews: withQuestions,
  });
}
