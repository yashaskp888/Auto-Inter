import { db } from "@/firebase/admin";
import { NextResponse } from "next/server";

interface TranscriptionMessage {
  role: "agent" | "user";
  text: string;
  timestamp: Date;
}

interface QAPair {
  question: string;
  answer: string;
  questionTimestamp: Date;
  answerTimestamp: Date;
  questionIndex?: number;
}

// Helper function to extract Q&A pairs from conversation
function extractQAPairs(messages: TranscriptionMessage[]): QAPair[] {
  const qaPairs: QAPair[] = [];
  let currentQuestion: TranscriptionMessage | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "agent") {
      // Agent messages are questions
      // Skip greetings and non-question statements
      const text = msg.text.toLowerCase().trim();
      const isGreeting = text.includes("hello") || 
                        text.includes("hi") || 
                        text.includes("greet") ||
                        text.includes("assistance") ||
                        text.includes("help you") ||
                        text.includes("generating");
      
      const isQuestion = text.includes("?") || 
                        text.includes("what") ||
                        text.includes("how") ||
                        text.includes("tell me") ||
                        text.includes("describe");

      if (!isGreeting && (isQuestion || text.length > 20)) {
        currentQuestion = msg;
      }
    } else if (msg.role === "user" && currentQuestion) {
      // User messages after agent questions are answers
      qaPairs.push({
        question: currentQuestion.text,
        answer: msg.text,
        questionTimestamp: currentQuestion.timestamp,
        answerTimestamp: msg.timestamp,
      });
      currentQuestion = null;
    }
  }

  return qaPairs;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { interviewId, roomName, userId, userName, messages, status, generatedInterviewId } = body;

    if (!interviewId || !roomName) {
      return NextResponse.json(
        { error: "Missing required fields: interviewId, roomName" },
        { status: 400 }
      );
    }

    // Save interview session document
    const interviewRef = db.collection("interviews").doc(interviewId);
    
    // Get existing interview or create new
    const interviewDoc = await interviewRef.get();
    
    const interviewData: any = {
      roomName,
      userId: userId || null,
      userName: userName || "Anonymous",
      updatedAt: new Date(),
    };

    // Link to generated interview if provided
    if (generatedInterviewId) {
      interviewData.generatedInterviewId = generatedInterviewId;
    }

    // Set startedAt only if creating new interview
    if (!interviewDoc.exists) {
      interviewData.startedAt = new Date();
    } else {
      interviewData.startedAt = interviewDoc.data()?.startedAt || new Date();
    }

    // Update status if provided
    if (status) {
      interviewData.status = status;
      if (status === "finished") {
        interviewData.finishedAt = new Date();
      }
    } else {
      interviewData.status = interviewDoc.exists 
        ? interviewDoc.data()?.status || "active"
        : "active";
    }

    await interviewRef.set(interviewData, { merge: true });

    // Save messages if provided
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const messagesRef = interviewRef.collection("messages");
      const batch = db.batch();

      for (const message of messages) {
        const messageRef = messagesRef.doc();
        batch.set(messageRef, {
          role: message.role,
          text: message.text,
          timestamp: message.timestamp 
            ? new Date(message.timestamp) 
            : new Date(),
          createdAt: new Date(),
        });
      }

      await batch.commit();

      // Extract and save Q&A pairs
      const qaPairs = extractQAPairs(messages.map((msg: any) => ({
        role: msg.role,
        text: msg.text,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })));

      if (qaPairs.length > 0) {
        const qaRef = interviewRef.collection("qaPairs");
        const qaBatch = db.batch();

        for (const qa of qaPairs) {
          const qaDocRef = qaRef.doc();
          qaBatch.set(qaDocRef, {
            question: qa.question,
            answer: qa.answer,
            questionTimestamp: qa.questionTimestamp,
            answerTimestamp: qa.answerTimestamp,
            createdAt: new Date(),
          });
        }

        await qaBatch.commit();

        // Update interview document with Q&A count
        await interviewRef.update({
          qaCount: qaPairs.length,
          lastQAPairAt: new Date(),
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      interviewId,
      messageCount: messages?.length || 0,
      qaPairsCount: messages && Array.isArray(messages) 
        ? extractQAPairs(messages.map((msg: any) => ({
            role: msg.role,
            text: msg.text,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          }))).length 
        : 0
    });
  } catch (error) {
    console.error("Error saving transcription:", error);
    return NextResponse.json(
      { error: "Failed to save transcription", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
