import type { CSSProperties } from 'react';

interface SkeletonProps { width?: CSSProperties['width']; height?: CSSProperties['height']; className?: string }

export function Skeleton({ width, height = 14, className = '' }: SkeletonProps) { return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />; }
