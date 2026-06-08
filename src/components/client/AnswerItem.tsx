"use client"

import { useState } from "react"
import { Pencil, CheckCircle } from "lucide-react"
import { VoteButtons } from "./VoteButtons"
import { AcceptButton } from "./AcceptButton"
import { AnswerForm } from "./AnswerForm"
import { RichContent } from "./RichEditor"
import { formatRelativeTime } from "@/lib/utils"

interface AnswerData {
  id: string
  content: string
  accepted: boolean
  voteCount: number
  createdAt: Date | string
  author: { id: string; name: string | null; image: string | null }
  _count: { comments: number }
}

interface VoteInfo {
  answerId: string
  up: number
  down: number
  userVote: number | null
}

interface AnswerItemProps {
  answer: AnswerData
  votes: VoteInfo
  isAuthor: boolean
  userId: string | undefined
  questionId: string
}

export function AnswerItem({ answer, votes, isAuthor, userId, questionId }: AnswerItemProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="rounded-lg border p-5">
        <AnswerForm
          questionId={questionId}
          userId={userId}
          editAnswerId={answer.id}
          editInitialContent={answer.content}
          onCancelEdit={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border p-5 ${
        answer.accepted ? "border-green-500 bg-green-50/30 dark:bg-green-950/10" : ""
      }`}
    >
      {answer.accepted && (
        <div className="mb-3 flex items-center gap-1 text-sm font-medium text-green-600">
          <CheckCircle className="h-4 w-4" />
          已采纳
        </div>
      )}
      <div className="flex gap-4">
        {/* Vote column */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <VoteButtons
            targetType="answer"
            targetId={answer.id}
            upVotes={votes.up}
            downVotes={votes.down}
            userVote={votes.userVote}
          />
          {isAuthor && !answer.accepted && (
            <AcceptButton answerId={answer.id} questionId={questionId} />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <RichContent html={answer.content} />
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{answer.author.name}</span>
            <span>·</span>
            <span>{formatRelativeTime(answer.createdAt)}</span>
            {userId === answer.author.id && (
              <>
                <span>·</span>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}