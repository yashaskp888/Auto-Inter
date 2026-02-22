import { Button } from '@/components/ui/button'
import React from 'react'
import Link from 'next/link'
import Img from 'next/image'
import InterviewCard from '@/components/InterviewCard'
import { isAuthenticated, getCurrentUser } from '@/lib/Actions/auth.actions'
import { getRecentInterviews, getInterviewsNotTakenByUser } from '@/lib/Actions/interview.actions'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const page = async () => {
  const isUserAuthenticated = await isAuthenticated()
  if (!isUserAuthenticated) redirect('/signin')

  const user = await getCurrentUser()
  if (!user) redirect('/signin')

  const recentInterviews = await getRecentInterviews(user.id, 4, user.email, user.sayableId)
  const notTakenInterviewIds = recentInterviews.map((i) => i.id)
  const interviewsNotTakenByMe = await getInterviewsNotTakenByUser(notTakenInterviewIds, 8)

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2 className="text-2xl">
            Get Interview Ready With Ai-Powered Practise & Feedback
          </h2>
          <p className="text-lg">
            Practise on real interview questions and get instant feedback from AI.
            Improve your skills and confidence before your next interview.
          </p>
          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start An Interview</Link>
          </Button>
        </div>
        <Img
          src="/robot.png"
          alt="Robot Dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>
      <section className="mt-6 px-4 flex flex-col gap-6">
        <h2>Your Recent Interviews</h2>
        <div className="interviews-section">
          {recentInterviews.length > 0 ? (
            recentInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interviewId={interview.id}
                userId={interview.userId}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                feedbackId={interview.feedbackId}
                hasFeedback={interview.hasFeedback}
              />
            ))
          ) : (
            <div className="space-y-3">
              <p className="text-light-300">
                No interviews yet. Start an interview to see your history here.
              </p>
              <p className="text-sm text-light-400">
                When the AI asks for your user ID, say your 4 digits clearly: <strong className="text-primary-100 font-mono text-lg">{user.sayableId?.split('').join(' ') ?? '—'}</strong>
              </p>
              <p className="text-xs text-light-500">
                Still not showing? Open{' '}
                <Link href="/api/debug-interviews" target="_blank" rel="noopener" className="underline text-primary-200">
                  /api/debug-interviews
                </Link>
                {' '}to see your code and what the app has stored — your 4-digit code must match.
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="mt-6 px-4 flex flex-col gap-6">
        <h2>Take An Interview</h2>
        <p className="text-sm text-light-400">
          Interviews taken by others — you haven&apos;t done these yet. Take any to practise.
        </p>
        <div className="interviews-section">
          {interviewsNotTakenByMe.length > 0 ? (
            interviewsNotTakenByMe.map((interview) => (
              <InterviewCard
                key={interview.id}
                interviewId={interview.id}
                userId={interview.userId}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                feedbackId={null}
                hasFeedback={false}
                notTakenByMe={true}
                sampleScore={interview.sampleScore}
              />
            ))
          ) : (
            <p className="text-light-300">
              No other interviews available right now. Start an interview to create one.
            </p>
          )}
        </div>
      </section>
    </>
  )
}

export default page
  