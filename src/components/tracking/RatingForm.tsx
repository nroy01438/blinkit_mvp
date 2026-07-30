"use client";

import { useState, useTransition } from "react";
import { submitRating } from "@/app/actions/orders";

export function RatingForm({ orderId, followUpQuestion }: { orderId: string; followUpQuestion?: string }) {
  const [stars, setStars] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div className="bg-surface border border-divider rounded-xl p-4 text-center">
        <p className="text-[13px] font-semibold text-text-primary">Thanks for the feedback! 🙌</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-divider rounded-xl p-4">
      <p className="text-[13px] font-bold text-text-primary mb-2">How was your delivery?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} className="text-2xl leading-none" aria-label={`${n} star`}>
            {n <= stars ? "⭐" : "☆"}
          </button>
        ))}
      </div>

      {followUpQuestion && (
        <div className="mb-3">
          <p className="text-[12.5px] text-text-secondary mb-1.5">{followUpQuestion}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setAnswer("worked_out")}
              className={`text-[12px] font-bold rounded-md px-3 py-1.5 border ${
                answer === "worked_out" ? "border-action-green bg-green-tint text-action-green" : "border-divider text-text-secondary"
              }`}
            >
              Yes, worked out 👍
            </button>
            <button
              onClick={() => setAnswer("not_quite")}
              className={`text-[12px] font-bold rounded-md px-3 py-1.5 border ${
                answer === "not_quite" ? "border-action-green bg-green-tint text-action-green" : "border-divider text-text-secondary"
              }`}
            >
              Not quite
            </button>
          </div>
        </div>
      )}

      <button
        disabled={stars === 0 || pending}
        onClick={() =>
          startTransition(async () => {
            await submitRating(orderId, stars, answer);
            setSubmitted(true);
          })
        }
        className="w-full bg-action-green text-white text-[12.5px] font-bold rounded-md py-2 disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  );
}
