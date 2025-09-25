"use client"

import * as React from "react"

type TypewriterProps = {
  phrases: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseBetween?: number
  loop?: boolean
  className?: string
}

export function Typewriter({
  phrases,
  typingSpeed = 40,
  deletingSpeed = 28,
  pauseBetween = 1200,
  loop = true,
  className,
}: TypewriterProps) {
  const [i, setI] = React.useState(0) // phrase index
  const [text, setText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    const current = phrases[i % phrases.length] ?? ""
    const doneTyping = text === current
    const doneDeleting = deleting && text.length === 0

    let timeout = typingSpeed

    if (!deleting) {
      // typing
      if (!doneTyping) {
        timeout = typingSpeed
        setTimeout(() => setText(current.slice(0, text.length + 1)), timeout)
      } else {
        // pause before deleting
        timeout = pauseBetween
        const t = setTimeout(() => setDeleting(true), timeout)
        return () => clearTimeout(t)
      }
    } else {
      // deleting
      if (!doneDeleting) {
        timeout = deletingSpeed
        setTimeout(() => setText(current.slice(0, text.length - 1)), timeout)
      } else {
        setDeleting(false)
        if (loop) setI((v) => (v + 1) % phrases.length)
      }
    }
    // cleanup no-op as we use setTimeout inline

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, deleting, i, phrases])

  React.useEffect(() => {
    // reset when phrases change
    setText("")
    setDeleting(false)
    setI(0)
  }, [phrases])

  return (
    <span className={className} aria-live="polite">
      {text}
    </span>
  )
}