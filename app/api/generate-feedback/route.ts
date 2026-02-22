import { db } from "@/firebase/admin";
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

interface QAPair {
  question: string;
  answer: string;
  questionTimestamp: Date;
  answerTimestamp: Date;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { interviewId, userId, generatedInterviewId } = body;

    if (!interviewId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: interviewId, userId" },
        { status: 400 }
      );
    }

    // Get the interview transcriptions
    const interviewRef = db.collection("interviews").doc(interviewId);
    const interviewDoc = await interviewRef.get();

    if (!interviewDoc.exists) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get Q&A pairs
    let qaPairs: QAPair[] = [];
    const qaPairsSnapshot = await interviewRef.collection("qaPairs").get();
    
    if (!qaPairsSnapshot.empty) {
      qaPairs = qaPairsSnapshot.docs.map((doc) => ({
        ...doc.data(),
        questionTimestamp: doc.data().questionTimestamp?.toDate(),
        answerTimestamp: doc.data().answerTimestamp?.toDate(),
      })) as QAPair[];
    }

    // If no Q&A pairs, try to extract from messages
    if (qaPairs.length === 0) {
      const messagesSnapshot = await interviewRef.collection("messages").get();
      if (messagesSnapshot.empty) {
        return NextResponse.json(
          { error: "No Q&A pairs or messages found for this interview. Please ensure the interview had conversation." },
          { status: 400 }
        );
      }
      
      // Extract Q&A pairs from messages - sort by timestamp
      const messages = messagesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            role: data.role,
            text: data.text || "",
            timestamp: data.timestamp?.toDate() || data.createdAt?.toDate() || new Date(),
          };
        })
        .filter(msg => msg.text && msg.text.trim()) // Filter out empty messages
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      console.log(`Found ${messages.length} messages to extract Q&A from`);
      console.log("Message breakdown:", {
        agent: messages.filter(m => m.role === "agent").length,
        user: messages.filter(m => m.role === "user").length,
        sample: messages.slice(0, 5).map(m => ({ role: m.role, text: m.text?.substring(0, 80) }))
      });
      
      // More lenient Q&A extraction from messages
      let currentQuestion: any = null;
      
      for (const msg of messages) {
        if (!msg.text || !msg.text.trim()) {
          continue; // Skip empty messages
        }

        const text = msg.text.toLowerCase().trim();
        
        if (msg.role === "agent") {
          // Agent messages are potential questions
          // Skip very short greetings
          const isShortGreeting = (text.includes("hello") || 
                                  text.includes("hi") || 
                                  text.includes("greet")) && text.length < 30;
          
          // If it's not a short greeting, treat as question/statement
          if (!isShortGreeting && text.length > 5) {
            currentQuestion = msg;
          }
        } else if (msg.role === "user") {
          // User messages are answers
          if (currentQuestion && msg.text) {
            qaPairs.push({
              question: currentQuestion.text,
              answer: msg.text,
              questionTimestamp: currentQuestion.timestamp,
              answerTimestamp: msg.timestamp,
            });
            console.log(`Extracted Q&A pair ${qaPairs.length}: Q="${currentQuestion.text.substring(0, 60)}..." A="${msg.text.substring(0, 60)}..."`);
            currentQuestion = null;
          } else if (msg.text && msg.text.length > 5) {
            // If no current question but user spoke, create a generic Q&A pair
            qaPairs.push({
              question: "User response",
              answer: msg.text,
              questionTimestamp: msg.timestamp,
              answerTimestamp: msg.timestamp,
            });
            console.log(`Extracted user response without question: "${msg.text.substring(0, 60)}..."`);
          }
        }
      }
      
      if (qaPairs.length === 0) {
        // Fallback: Create Q&A pairs from any user messages, even without clear questions
        const userMessages = messages.filter(m => m.role === "user" && m.text && m.text.trim().length > 5);
        const agentMessages = messages.filter(m => m.role === "agent" && m.text && m.text.trim().length > 5);
        
        if (userMessages.length > 0) {
          // Create Q&A pairs from user responses
          for (let i = 0; i < userMessages.length; i++) {
            const userMsg = userMessages[i];
            const precedingAgent = agentMessages.find(m => m.timestamp < userMsg.timestamp);
            
            qaPairs.push({
              question: precedingAgent?.text || `Question ${i + 1}`,
              answer: userMsg.text,
              questionTimestamp: precedingAgent?.timestamp || userMsg.timestamp,
              answerTimestamp: userMsg.timestamp,
            });
          }
          
          console.log(`Created ${qaPairs.length} Q&A pairs from user messages (fallback mode)`);
        } else if (agentMessages.length > 0) {
          // Only agent messages - create placeholder Q&A pairs so we can still generate feedback
          // This allows feedback page to load with a note that user answers weren't captured
          for (let i = 0; i < agentMessages.length; i++) {
            qaPairs.push({
              question: agentMessages[i].text,
              answer: "[User response not captured - ensure microphone is enabled and speak clearly]",
              questionTimestamp: agentMessages[i].timestamp,
              answerTimestamp: agentMessages[i].timestamp,
            });
          }
          console.log(`Created ${qaPairs.length} placeholder Q&A pairs (agent only - no user responses captured)`);
        } else {
          return NextResponse.json(
            { 
              error: "Could not extract Q&A pairs from interview messages.",
              details: {
                totalMessages: messages.length,
                suggestion: "Please ensure you speak during the interview and microphone is enabled."
              }
            },
            { status: 400 }
          );
        }
      }
      
      console.log(`Successfully extracted ${qaPairs.length} Q&A pairs from messages`);
    }

    // Get generated interview questions if available
    let generatedQuestions: string[] = [];
    if (generatedInterviewId) {
      const generatedInterviewDoc = await db
        .collection("interviews")
        .doc(generatedInterviewId)
        .get();
      if (generatedInterviewDoc.exists) {
        generatedQuestions = generatedInterviewDoc.data()?.questions || [];
      }
    }

    // Prepare Q&A context for AI
    const hasPlaceholderAnswers = qaPairs.some(qa => qa.answer.includes("[User response not captured"));
    const qaContext = qaPairs
      .map((qa, index) => `Question ${index + 1}: ${qa.question}\nAnswer: ${qa.answer}`)
      .join("\n\n");

    const contextNote = hasPlaceholderAnswers 
      ? "\n\nNote: User responses were not captured during this interview. Provide feedback focused on the questions asked and suggest the user ensure their microphone is enabled and they speak clearly during future interviews."
      : "";

    // Check if Groq API key is configured
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set");
      return NextResponse.json(
        { error: "AI service not configured. Please set GROQ_API_KEY environment variable." },
        { status: 500 }
      );
    }

    // Generate feedback using AI
    let feedbackText: string;
    let aiFailed = false;
    try {
      const result = await generateText({
        model: groq("llama-3.1-8b-instant"), // Same model as vapi/generate - more reliable
        prompt: `You are an expert interview evaluator. Analyze the following interview Q&A pairs and score the candidate fairly.

SCORING RULES (follow strictly):
- Give HIGHER scores (70-100) when the candidate gives correct, relevant, and detailed answers. Reward good technical knowledge and clear communication.
- Give LOWER scores (0-50) when the candidate does not answer, says "I don't know", gives wrong or irrelevant answers, or gives very short/vague responses.
- Do NOT give high scores when answers are missing, wrong, or off-topic.
- Do NOT give low scores when the candidate clearly answered correctly and in depth.
- totalScore should reflect the overall quality of answers across all Q&A pairs.

Interview Questions and Answers:
${qaContext}
${contextNote}

${generatedQuestions.length > 0 ? `\nExpected Questions (use to check if answers address the topic):\n${generatedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : ""}

Provide feedback in the following JSON format (no markdown, valid JSON only):
{
  "totalScore": <number 0-100, must match quality of answers>,
  "categoryScores": [
    {
      "name": "<category name>",
      "score": <number 0-100>,
      "comment": "<detailed comment tied to the actual answers>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "areasForImprovement": ["<area 1>", "<area 2>", ...],
  "finalAssessment": "<overall assessment that reflects whether answers were correct and complete>"
}

Categories: Technical Knowledge, Communication Skills, Problem Solving, Clarity of Expression, Depth of Understanding.

Be specific and fair. Base scores only on what the candidate actually said.`,
      });
      feedbackText = result.text;
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      aiFailed = true;
      // Use fallback feedback so user still gets redirected to feedback page
      feedbackText = JSON.stringify({
        totalScore: 70,
        categoryScores: [
          { name: "Technical Knowledge", score: 70, comment: "Could not evaluate - AI service temporarily unavailable." },
          { name: "Communication Skills", score: 70, comment: "Could not evaluate - AI service temporarily unavailable." },
          { name: "Overall Performance", score: 70, comment: "Interview completed. AI feedback generation failed. Please try again or check your GROQ_API_KEY." },
        ],
        strengths: ["Completed the interview"],
        areasForImprovement: [
          "Ensure GROQ_API_KEY is set in .env.local",
          "Check Groq API rate limits at console.groq.com",
        ],
        finalAssessment: "Your interview has been completed. We were unable to generate AI-powered feedback at this time. This can happen if the Groq API key is missing, invalid, or rate limited. Please check your configuration and try again.",
      });
    }

    // Parse the feedback JSON
    let feedback;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse feedback JSON:", parseError);
      // Fallback feedback structure
      feedback = {
        totalScore: 70,
        categoryScores: [
          {
            name: "Overall Performance",
            score: 70,
            comment: "Please review the interview transcript for detailed feedback.",
          },
        ],
        strengths: ["Completed the interview"],
        areasForImprovement: ["Review your answers for improvement"],
        finalAssessment: feedbackText || "Interview completed. Review your answers for areas of improvement.",
      };
    }

    // Save feedback to Firebase
    const feedbackData = {
      interviewId,
      userId,
      generatedInterviewId: generatedInterviewId || null,
      totalScore: feedback.totalScore || 0,
      categoryScores: feedback.categoryScores || [],
      strengths: feedback.strengths || [],
      areasForImprovement: feedback.areasForImprovement || [],
      finalAssessment: feedback.finalAssessment || "",
      createdAt: new Date().toISOString(),
    };

    const feedbackRef = db.collection("feedback").doc();
    await feedbackRef.set(feedbackData);

    return NextResponse.json({
      success: true,
      feedbackId: feedbackRef.id,
      feedback: feedbackData,
    });
  } catch (error) {
    console.error("Error generating feedback:", error);
    return NextResponse.json(
      {
        error: "Failed to generate feedback",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
