'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface RetakeInterviewButtonProps {
  sourceInterviewId: string;
  userId: string;
  children?: React.ReactNode;
}

export default function RetakeInterviewButton({
  sourceInterviewId,
  userId,
  children = 'Retake',
}: RetakeInterviewButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleRetake() {
    setLoading(true);
    try {
      const res = await fetch('/api/retake-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceInterviewId, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create retake');
      if (data.interviewId) {
        window.location.href = `/interview/${data.interviewId}`;
      }
    } catch (e) {
      console.error(e);
      alert('Could not create retake. Please try again.');
      setLoading(false);
    }
  }

  return (
    <Button
      className="btn-secondary"
      onClick={handleRetake}
      disabled={loading}
    >
      {loading ? 'Creating...' : children}
    </Button>
  );
}
