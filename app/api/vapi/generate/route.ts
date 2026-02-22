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

/** Normalize voice userid so "one two three four" or "1 2 3 4" becomes "1234" for reliable lookup */
function normalizeUserId(userid: string): string {
  if (!userid || typeof userid !== 'string') return userid || ''
  const words: Record<string, string> = {
    zero: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  }
  let s = userid.toLowerCase().trim().replace(/\s+/g, ' ')
  const parts = s.split(/\s+/)
  const digits: string[] = []
  for (const p of parts) {
    const word = p.replace(/[^a-z0-9]/g, '')
    if (words[word]) digits.push(words[word])
    else if (/^\d$/.test(p)) digits.push(p)
    else if (/^\d+$/.test(p)) digits.push(...p.split(''))
  }
  if (digits.length >= 4) return digits.slice(0, 4).join('')
  const noSpaces = userid.replace(/\s/g, '')
  if (/^\d{4}$/.test(noSpaces)) return noSpaces
  return userid.trim()
}

export async function POST(request:Request){
    const {type,role,level,techstack,amount,userid}=await request.json()
    const normalizedUserId = normalizeUserId(userid || '')
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
            questions:extractJsonArray(questions),
            userId: normalizedUserId || userid || '',
            finalized:true,
            coverImage:getRandomInterviewCover(),
            createdAt:new Date().toISOString()
        }
        const ref = await db.collection('interviews').add(interview)
        return Response.json({success:true, interviewId: ref.id},{status:200})

    } catch(e){
        console.log(e)
        return Response.json({success:false,e},{status:500})
    }}