import { groq } from '@ai-sdk/groq'
import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { getRandomInterviewCover } from "@/lib/utils"
import { db } from "@/firebase/admin"

export async function GET(){
    return Response.json({success:true,data:'THANK YOU!'},{status:200})
}
function extractJsonArray(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array found')
  return JSON.parse(match[0])
}

export async function POST(request:Request){
    const {type,role,level,techstack,amount,userid}=await request.json()
    try{
        console.log(
  'Groq key loaded:',
  process.env.GROQ_API_KEY?.startsWith('gsk_')
)

        const {text:questions}=await generateText({
            model:groq('llama-3.1-8b-instant'),


            prompt:`prepare questions for a job intervew.
            the job role is :${role}.
            the job experience level is :${level}.
            the tech stack used in the job is :${techstack}.
            the amount of questions required is:${amount}.
            please return only the questions without any additional text.
            the questions are read by the voice agent so dont use "/" or "*" or any other special characters in the questions that may break the voice assistant.
            return the question formatted like this:
            ["Question 1","Question 2","Question 3",...] 
            
            thank you
            `, 
        })
        const interview={
            role,type,level,
            techstack:techstack.split(','),
            questions:extractJsonArray(questions)
,
            userId:userid,
            finalized:true,
            coverImage:getRandomInterviewCover(),
            createdAt:new Date().toISOString()
        }
        await db.collection('interviews').add(interview)
        return Response.json({success:true},{status:200})

    } catch(e){
        console.log(e)
        return Response.json({success:false,e},{status:500})
    }}