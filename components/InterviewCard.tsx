
import React from 'react'
import dayjs from 'dayjs'
import { cn, getRandomInterviewCover, getTechLogos } from '@/lib/utils'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { db } from '@/firebase/admin'     


const InterviewCard = async({interviewId,userId,role,type,techstack,createdAt}:InterviewCardProps) => {
    let feedBack: Feedback | null = null

if (interviewId && userId) {
  const feedbackSnap = await db
    .collection('feedback')
    .where('interviewId', '==', interviewId)
    .where('userId', '==', userId)
    .limit(1)
    .get()

  feedBack = feedbackSnap.empty
    ? null
    : (feedbackSnap.docs[0].data() as Feedback)
}

    const techIcons= await getTechLogos(techstack)
    const normalisedType= /mix/i.test(type)?"Mixed":type
    const formattedDate=dayjs(feedBack?.createdAt||createdAt||Date.now()).format("MMM D, YYYY")
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
                        <p>{feedBack?.totalScore||'---'}/100</p>
                </div>
            </div>
            <p className="line-clamp-2 mt-5">
                {feedBack?.finalAssessment||"You haven't taken this interview yet. Take it now to improve your skills!"}
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

  {/* Right: Button */}
  <Button className="btn-primary">
    <Link
      href={
        feedBack
          ? `/interview/${interviewId}/feedBack`
          : `/interview/${interviewId}`
      }
    >
      {feedBack ? "Check Feedback" : "Take Interview"}
    </Link>
  </Button>
</div>

        </div>
    </div>
    )
    }


export default InterviewCard
