import { Button } from '@/components/ui/button'
import React from 'react'
import Link from 'next/link' 
import Img from 'next/image' 
import { dummyInterviews } from '@/constants'
import InterviewCard from '@/components/InterviewCard'
import { isAuthenticated } from "@/lib/Actions/auth.actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const page = async() => {
  const isUserAuthenticated=await isAuthenticated()
  console.log("AUTH:", isUserAuthenticated);

  if(!isUserAuthenticated) redirect('/signin')
  return (
    
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2 className="text-2xl">Get Interview Ready With Ai-Powered Practise & Feedback  </h2>
          <p className="text-lg">Practise on real interview questions and get instant feedback from AI. Improve your skills and confidence before your next interview.</p>
          <Button asChild className="btn-primary max-sm:w-full"><Link href="/Interview">Start An Interview</Link></Button>
        </div>
        <Img src="/robot.png" alt="Robot Dude" width={400} height={400} className="max-sm:hidden" />
      </section>
      <section className="mt-6 px-4 flex flex-col gap-6">
        <h2>Your Interviews</h2>
        <div className="interviews-section">
          {dummyInterviews.map((interview) => (
            <InterviewCard {...interview} key={interview.id} />
          ))}
        </div>
      </section>
      <section className="mt-6 px-4 flex flex-col gap-6">
        <h2>Take An Interview</h2>
        <div className="interviews-section">
          {dummyInterviews.map((interview) => (
            <InterviewCard {...interview} key={interview.id} />
          ))}
          {/*<p>No interviews available yet. </p>*/}
          {}
        </div>
      </section>
    </>
  )
}

export default page
  