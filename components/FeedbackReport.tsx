"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FeedbackReportProps {
  feedback: Feedback;
  interview?: any;
}

const FeedbackReport = ({ feedback, interview }: FeedbackReportProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success-100";
    if (score >= 60) return "text-primary-200";
    return "text-destructive-100";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-success-100/20 border-success-100";
    if (score >= 60) return "bg-primary-200/20 border-primary-200";
    return "bg-destructive-100/20 border-destructive-100";
  };

  return (
    <div className="root-layout">
      <div className="section-feedback">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <h1 className="text-4xl font-bold text-primary-100">
            Interview Feedback Report
          </h1>
          {interview && (
            <div className="flex flex-wrap gap-4 text-light-100">
              {interview.role && (
                <span className="px-4 py-2 rounded-full bg-dark-200">
                  Role: {interview.role}
                </span>
              )}
              {interview.level && (
                <span className="px-4 py-2 rounded-full bg-dark-200">
                  Level: {interview.level}
                </span>
              )}
              {interview.type && (
                <span className="px-4 py-2 rounded-full bg-dark-200 capitalize">
                  Type: {interview.type}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Overall Score */}
        <div
          className={cn(
            "dark-gradient rounded-2xl p-8 border-2",
            getScoreBgColor(feedback.totalScore)
          )}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-light-100 mb-2">
                Overall Score
              </h2>
              <p className="text-light-400">
                Based on your interview performance
              </p>
            </div>
            <div className="text-center">
              <div
                className={cn(
                  "text-6xl font-bold mb-2",
                  getScoreColor(feedback.totalScore)
                )}
              >
                {feedback.totalScore}
              </div>
              <div className="text-light-100 text-sm">out of 100</div>
            </div>
          </div>
        </div>

        {/* Category Scores */}
        {feedback.categoryScores && feedback.categoryScores.length > 0 && (
          <div className="dark-gradient rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-primary-100 mb-6">
              Category Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {feedback.categoryScores.map((category, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-6 rounded-xl border-2",
                    getScoreBgColor(category.score)
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-light-100">
                      {category.name}
                    </h3>
                    <span
                      className={cn(
                        "text-2xl font-bold",
                        getScoreColor(category.score)
                      )}
                    >
                      {category.score}
                    </span>
                  </div>
                  <p className="text-light-400 text-sm leading-relaxed">
                    {category.comment}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <div className="dark-gradient rounded-2xl p-8 border-2 border-success-100/50">
            <h2 className="text-2xl font-semibold text-success-100 mb-6">
              Strengths
            </h2>
            <ul className="space-y-3">
              {feedback.strengths.map((strength, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-light-100"
                >
                  <span className="text-success-100 text-xl mt-1">✓</span>
                  <span className="text-lg">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for Improvement */}
        {feedback.areasForImprovement &&
          feedback.areasForImprovement.length > 0 && (
            <div className="dark-gradient rounded-2xl p-8 border-2 border-primary-200/50">
              <h2 className="text-2xl font-semibold text-primary-200 mb-6">
                Areas for Improvement
              </h2>
              <ul className="space-y-3">
                {feedback.areasForImprovement.map((area, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-light-100"
                  >
                    <span className="text-primary-200 text-xl mt-1">→</span>
                    <span className="text-lg">{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Final Assessment */}
        {feedback.finalAssessment && (
          <div className="dark-gradient rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-primary-100 mb-6">
              Final Assessment
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-light-100 text-lg leading-relaxed whitespace-pre-line">
                {feedback.finalAssessment}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <button
            onClick={() => (window.location.href = "/")}
            className="btn-primary"
          >
            Back to Home
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary"
          >
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackReport;
