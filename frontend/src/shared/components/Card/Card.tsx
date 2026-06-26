import { type HTMLAttributes, type JSX } from 'react'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
}

export const Card = ({ padding = 'md', children, className, ...props }: CardProps): JSX.Element => {
  return (
    <div className={`${styles.card} ${styles[padding]} ${className ?? ''}`} {...props}>
      {children}
    </div>
  )
}
