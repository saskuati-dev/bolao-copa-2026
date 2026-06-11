'use client';

import { useEffect, useState, useRef } from 'react';

interface Props {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: Props) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onCloseRef.current(), 300);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const color = type === 'error' ? 'var(--red)' : 'var(--green)';
  const bg = type === 'error' ? 'var(--red-bg)' : 'var(--green-bg)';

  return (
    <div
      className={`toast ${visible ? 'toast-in' : 'toast-out'}`}
      style={{ background: bg, borderLeft: `3px solid ${color}` }}
    >
      {message}
    </div>
  );
}
