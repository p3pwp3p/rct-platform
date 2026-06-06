import { CSSProperties, ReactNode } from 'react'

interface FloatingCardProps {
  style?: CSSProperties
  animationDelay?: string
  children: ReactNode
  className?: string
}

export default function FloatingCard({ style, animationDelay, children, className = '' }: FloatingCardProps) {
  return (
    <div
      className={`glass rounded-lg p-3 animate-float ${className}`}
      style={{
        animationDelay: animationDelay ?? '0s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
