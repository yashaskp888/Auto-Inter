import React from 'react'
import dayjs from 'dayjs'
import { cn, getRandomInterviewCover, getTechLogos } from '@/lib/utils'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { db } from '@/firebase/admin'
import RetakeInterviewButton from './RetakeInterviewButton'

const InterviewCard = async({
  interviewId,
  userId,
  role,
  type,
  techstack,
  createdAt,
  feedbackId,
  hasFeedback,
  notTakenByMe,
  sampleScore,
}: InterviewCardProps) => {
  let feedBack: (Feedback & { id?: string }) | null = null
  let resolvedFeedbackId: string | null = feedbackId || null

  if (!notTakenByMe && feedbackId && hasFeedback) {
    const fbDoc = await db.collection('feedback').doc(feedbackId).get()
    feedBack = fbDoc.exists ? (fbDoc.data() as Feedback & { id: string }) : null
    resolvedFeedbackId = feedBack ? feedbackId : null
  }
  if (!notTakenByMe && interviewId && userId && !feedbackId) {
    const feedbackSnap = await db
      .collection('feedback')
      .where('generatedInterviewId', '==', interviewId)
      .where('userId', '==', userId)
      .limit(1)
      .get()
    if (!feedbackSnap.empty) {
      const doc = feedbackSnap.docs[0]
      feedBack = { ...(doc.data() as Feedback), id: doc.id }
      resolvedFeedbackId = doc.id
    }
  }

  const techIcons = await getTechLogos(techstack)
  const normalisedType = /mix/i.test(type) ? 'Mixed' : type
  const formattedDate = dayjs(feedBack?.createdAt || createdAt || Date.now()).format('MMM D, YYYY')
  const showFeedbackForCard = !notTakenByMe && !!feedBack
  const displayScore = notTakenByMe ? (sampleScore ?? undefined) : feedBack?.totalScore
  const statusMessage = notTakenByMe
    ? "You haven't taken this interview yet. Take it now to improve your skills!"
    : (feedBack?.finalAssessment || "You haven't taken this interview yet. Take it now to improve your skills!")
    return (
    <div className="card-border w-87.5 max-sm:w-full min-h-96">
        <div className="card-interview">
            <div>
                <div className="absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg bg-light-600">
                    <p className="badge-text">{normalisedType}</p>
                </div>
                <Image src={getRandomInterviewCover()} alt="Company Logo" width={90} height={90} className="size-22.5 object-fit rounded-full" />
                <h3 className="capitalize mt-5">{role} Interview</h3>
                <div className="flex flex-row mt-3 gap-5">
                    <div className="flex flex-row gap-2">
                        <Image src="/calendar.svg" alt="Calendar Icon" width={16} height={16} />
                        <p className="text-sm text-light-300">{formattedDate}</p>
                    </div>
                    <div className="flex flex-row gap-2">
                        <Image src="/star.svg" alt="Star Icon" width={22} height={22} />
                        <p>{displayScore != null ? displayScore : '---'}/100</p>
                </div>
            </div>
            <p className="line-clamp-2 mt-5">
                {statusMessage}
            </p>
        </div>
     <div className="flex flex-row items-center justify-between">
  {/* Left: Tech Icons */}
  <div className="flex flex-row">
    {techIcons.slice(0, 3).map(({ tech, url }, index) => (
      <div
        key={tech}
        className={cn(
          "relative group bg-dark-300 rounded-full p-2 flex-center",
          index > 0 && "-ml-3"
        )}
      >
        <span className="tech-tooltip">{tech}</span>
        <Image
          src={url}
          alt={tech}
          width={100}
          height={100}
          className="size-5 object-fit"
        />
      </div>
    ))}
  </div>

  {/* Right: Buttons */}
  <div className="flex flex-row gap-2">
    {showFeedbackForCard && resolvedFeedbackId && (
      <Button className="btn-primary" asChild>
        <Link href={`/feedback/${resolvedFeedbackId}`}>Check Feedback</Link>
      </Button>
    )}
    {(!showFeedbackForCard || notTakenByMe) && interviewId && (
      <Button className="btn-primary" asChild>
        <Link href={`/interview/${interviewId}`}>Take Interview</Link>
      </Button>
    )}
    {showFeedbackForCard && !notTakenByMe && interviewId && userId && (
      <RetakeInterviewButton
        sourceInterviewId={interviewId}
        userId={userId}
      >
        Retake
      </RetakeInterviewButton>
    )}
  </div>
</div>

        </div>
    </div>
    )
    }


export default InterviewCard
