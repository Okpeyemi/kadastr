"use client"

import * as React from "react"
import { useRef, useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  MessageCircle,
  Send,
  Paperclip,
  Mic,
  Bot,
  User,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Globe, // + ajouter l'icône
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Petite pastille "3 points" animés
function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

export type ChatPosition = "bottom-right" | "bottom-left"
export type ChatSize = "sm" | "md" | "lg" | "xl" | "full"

const chatConfig = {
  dimensions: {
    sm: "sm:max-w-sm sm:max-h-[500px]",
    md: "sm:max-w-md sm:max-h-[600px]",
    lg: "sm:max-w-lg sm:max-h-[700px]",
    xl: "sm:max-w-xl sm:max-h-[800px]",
    full: "sm:w-full sm:h-full",
  },
  positions: {
    "bottom-right": "bottom-5 right-5",
    "bottom-left": "bottom-5 left-5",
  },
  chatPositions: {
    "bottom-right": "sm:bottom-[calc(100%+10px)] sm:right-0",
    "bottom-left": "sm:bottom-[calc(100%+10px)] sm:left-0",
  },
  states: {
    open: "pointer-events-auto opacity-100 visible scale-100 translate-y-0",
    closed: "pointer-events-none opacity-0 invisible scale-100 sm:translate-y-5",
  },
}

type Message = {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  audioFile?: string
}

type AudioFile = {
  id: string
  name: string
  url: string
  size: number
}

function useAutoScroll(content?: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [content])
  return { scrollRef }
}

function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // --- ajout: analyse audio temps réel ---
  const [level, setLevel] = useState(0) // 0..1
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTsRef = useRef<number>(0)

  const teardownAnalyser = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    analyserRef.current = null
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {
        // noop
      }
    }
    audioCtxRef.current = null
  }

  const startMeter = (stream: MediaStream) => {
  // éviter any: typer proprement la fenêtre avec webkitAudioContext
  type MaybeWebkitWindow = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const W = window as MaybeWebkitWindow
  const Ctx = W.AudioContext ?? W.webkitAudioContext
  if (!Ctx) {
    console.warn("Web Audio API non supportée dans ce navigateur.")
    return
  }
  const ctx = new Ctx()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyserRef.current = analyser
    source.connect(analyser)

    const data = new Uint8Array(analyser.fftSize)
    startTsRef.current = performance.now()

    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteTimeDomainData(data)
      // RMS sur le signal centré [-1..1]
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      setLevel(Math.min(1, Math.max(0, rms))) // clamp 0..1
      setElapsedSeconds((performance.now() - startTsRef.current) / 1000)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      mediaRecorder.onstop = () => setAudioBlob(new Blob(chunks, { type: "audio/webm" }))
      mediaRecorder.start()
      // --- start realtime meter ---
      setElapsedSeconds(0)
      setLevel(0)
      startMeter(stream)
      setIsRecording(true)
    } catch {
      // noop
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      teardownAnalyser()
    }
  }

  const clearRecording = () => {
    setAudioBlob(null)
    setElapsedSeconds(0)
    setLevel(0)
  }

  return { isRecording, audioBlob, level, elapsedSeconds, startRecording, stopRecording, clearRecording }
}

function AudioPlayer({ src, onRemove }: { src: string; onRemove?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  const format = (s: number) => {
    const m = Math.floor((s || 0) / 60)
    const r = Math.floor((s || 0) % 60)
    return `${m}:${`${r}`.padStart(2, "0")}`
  }

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (isPlaying) a.pause()
    else a.play()
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    const a = audioRef.current
    if (!a) return
    a.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const onTimeUpdate = () => {
    const a = audioRef.current
    if (!a) return
    setCurrent(a.currentTime)
    setDuration(a.duration || 0)
    const p = (a.currentTime / (a.duration || 1)) * 100
    setProgress(Number.isFinite(p) ? p : 0)
  }

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const next = (x / rect.width) * a.duration
    if (Number.isFinite(next)) a.currentTime = next
  }

  return (
    <motion.div
      className="bg-background border border-border rounded-lg p-3 space-y-2"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <audio ref={audioRef} src={src} className="hidden" onTimeUpdate={onTimeUpdate} onLoadedMetadata={onTimeUpdate} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={togglePlay} className="h-8 w-8">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const a = document.createElement("a")
              a.href = src
              a.download = "audio.webm"
              a.click()
            }}
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </Button>
          {onRemove && (
            <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="w-full h-2 bg-muted rounded-full cursor-pointer" onClick={onSeek}>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{format(current)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>
    </motion.div>
  )
}

function ChatMessage({ message, onRemoveAudio }: { message: Message; onRemoveAudio?: (id: string) => void }) {
  const isUser = message.sender === "user"
  
  // Consistent time formatting that works on both server and client
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }
  
  return (
    <motion.div
      className={cn("flex gap-3 max-w-[80%]", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Avatar */}
      <div>
        <div className={cn("shrink-0 mt-1 rounded-full grid place-items-center", isUser ? "bg-primary/10" : "bg-muted")}>
        {isUser ? <User className="h-5 w-5 text-primary p-1" /> : <Bot className="h-5 w-5 text-muted-foreground p-1" />}
      </div>
      </div>

      {/* Bubble */}
      <div className={cn(
        "rounded-2xl px-3 py-2 text-sm shadow-sm border",
        isUser ? "bg-primary text-primary-foreground border-primary/20" : "bg-background border-border"
      )}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          // >>> Rendu Markdown pour l'assistant
          <div className="whitespace-pre-wrap break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                  a: ({ node, ...props }: any) => <a {...props} target="_blank" rel="noreferrer" className="underline" />,
                  code: ({ inline, className, children, ...props }: any) =>
                    inline ? (
                      <code className="px-1 py-[2px] rounded bg-muted text-foreground/90" {...props}>{children}</code>
                    ) : (
                      <pre className="p-3 rounded-md bg-muted overflow-x-auto"><code {...props}>{children}</code></pre>
                    ),
                  ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                  h2: ({ node, ...props }: any) => <h2 className="mt-2 mb-1 font-semibold text-base" {...props} />,
                  h3: ({ node, ...props }: any) => <h3 className="mt-2 mb-1 font-semibold" {...props} />,
                  table: ({ node, ...props }: any) => <div className="overflow-x-auto"><table className="border-collapse text-xs" {...props} /></div>,
                  th: ({ node, ...props }: any) => <th className="border px-2 py-1 bg-muted/50" {...props} />,
                  td: ({ node, ...props }: any) => <td className="border px-2 py-1" {...props} />,
                }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.audioFile && (
          <div className="mt-2">
            <AudioPlayer src={message.audioFile} onRemove={onRemoveAudio ? () => onRemoveAudio(message.id) : undefined} />
          </div>
        )}
        <div className={cn("mt-1 text-[10px]", isUser ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70")}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  )
}

function ChatMessageList({ messages, onRemoveAudio }: { messages: Message[]; onRemoveAudio?: (id: string) => void }) {
  const { scrollRef } = useAutoScroll(messages)
  return (
    <div className="relative w-full h-full">
      <div ref={scrollRef} className="flex flex-col w-full h-full p-4 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} onRemoveAudio={onRemoveAudio} />
        ))}
      </div>
    </div>
  )
}

// + helper: convertir un Blob en base64 (pour l’API)
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = String(reader.result || "")
      const b64 = res.includes(",") ? res.split(",")[1]! : res
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function AudioChatbotWidget({
  position = "bottom-right",
  size = "md",
  icon,
  className,
}: {
  position?: ChatPosition
  size?: ChatSize
  icon?: React.ReactNode
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Bonjour ! Je suis votre assistant IA. Envoyez un message texte, joignez un audio ou enregistrez votre voix.",
      sender: "ai",
      timestamp: new Date(),
    },
  ]) // initial messages
  const [inputValue, setInputValue] = useState("")
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [submittingAudio, setSubmittingAudio] = useState(false)
  const [useWeb, setUseWeb] = useState<boolean>(() => {
    try { return localStorage.getItem("chat:useWeb") !== "0" } catch { return true }
  })
  // const [isPending, startTransition] = useTransition()
  const [, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isRecording, audioBlob, startRecording, stopRecording, clearRecording, level, elapsedSeconds } = useVoiceRecorder()

  // Envoi auto dès la fin de l’enregistrement
  React.useEffect(() => {
    if (audioBlob && !isRecording && !isProcessing && !submittingAudio) {
      setSubmittingAudio(true)
      ;(async () => {
        try { await handleSendMessage() } finally { setSubmittingAudio(false) }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, isRecording, submittingAudio])

  React.useEffect(() => {
    try { localStorage.setItem("chat:useWeb", useWeb ? "1" : "0") } catch {}
  }, [useWeb])

  const toggleChat = () => setIsOpen((v) => !v)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("audio/"))
    files.forEach((file) => {
      const url = URL.createObjectURL(file)
      setAudioFiles((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, name: file.name, url, size: file.size }])
    })
    if (e.target) e.target.value = ""
  }

  const removeAudioFile = (id: string) => {
    setAudioFiles((prev) => {
      const f = prev.find((x) => x.id === id)
      if (f) URL.revokeObjectURL(f.url)
      return prev.filter((x) => x.id !== id)
    })
  }

  const removeAudioFromMessage = (messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, audioFile: undefined } : m)))
  }

  const handleSendMessage = async () => {
    if (isProcessing || submittingAudio) return
     if (!inputValue.trim() && audioFiles.length === 0 && !audioBlob) return
    if (audioBlob || audioFiles.length > 0) setSubmittingAudio(true)

     // snapshot de l'historique AVANT d’ajouter le nouveau message
     const prior = messages

     // --- Nouveau: préparer transcription si audio présent ---
    let transcript = ""
    let attachedUrl: string | undefined
    try {
      // Enregistré depuis le micro
      if (audioBlob) {
        attachedUrl = URL.createObjectURL(audioBlob)
        const base64 = await blobToBase64(audioBlob)
        const tr = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64, mimeType: audioBlob.type || "audio/webm", language: "fr" }),
        })
        const tj = await tr.json().catch(() => ({}))
        transcript = (tj?.text || "").trim()
        clearRecording()
      }
      // Fichier uploadé (premier de la liste)
      else if (audioFiles.length > 0) {
        attachedUrl = audioFiles[0].url
        const resp = await fetch(attachedUrl)
        const b = await resp.blob()
        const base64 = await blobToBase64(b)
        const tr = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64, mimeType: b.type || "audio/webm", language: "fr" }),
        })
        const tj = await tr.json().catch(() => ({}))
        transcript = (tj?.text || "").trim()
        setAudioFiles([])
      }
    } catch {
      // si la transcription échoue, on continue quand même avec le texte saisi
    }

    const typed = inputValue.trim()
    // Concatène si l'utilisateur a aussi tapé du texte
    const finalContent = typed && transcript
      ? `${typed}\n\n[Transcription]: ${transcript}`
      : (typed || transcript)

    // si rien à envoyer au final
    if (!finalContent) return

    const msg: Message = {
      id: `${Date.now()}`,
      content: finalContent,
      sender: "user",
      timestamp: new Date(),
      audioFile: attachedUrl,
    }

    setMessages((prev) => [...prev, msg])
    setInputValue("")
    setIsProcessing(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: msg.content || "Bonjour",
          context: [],
          history: prior
            .filter(m => m.content && m.content.trim().length)
            .map(m => ({ role: m.sender, content: m.content })),
          useWeb,
        }),
      })
      const data = await res.json()
      const reply = data?.text || "Je n’ai pas cette information dans mes ressources foncières béninoises."

      const ai: Message = {
        id: `${Date.now() + 1}`,
        content: "",
        sender: "ai",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, ai])
      setIsProcessing(false)
      setSubmittingAudio(false)

      const speed = 12 // un peu plus rapide
      ;(async () => {
        for (let i = 1; i <= reply.length; i++) {
          const ch = reply[i - 1]
          const delay = /\s|[.,;:!?]/.test(ch) ? 0 : speed
          await new Promise((r) => setTimeout(r, delay))
          setMessages((prev) =>
            prev.map((m) => (m.id === ai.id ? { ...m, content: reply.slice(0, i) } : m))
          )
        }
      })()
    } catch {
      setIsProcessing(false)
      setSubmittingAudio(false)
      const ai: Message = {
        id: `${Date.now() + 1}`,
        content: "Une erreur est survenue lors de l’appel à l’IA.",
        sender: "ai",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, ai])
    } finally {
      // rien
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor((s || 0) / 60)
    const r = Math.floor((s || 0) % 60)
    return `${m}:${`${r}`.padStart(2, "0")}`
  }

  return (
    <div className={cn(`fixed ${chatConfig.positions[position]} z-50`, className)}>
      <div
        className={cn(
          // Panel: verre dépoli + ombres + arrondis + anneau subtil
          "flex flex-col bg-card/90 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5",
          // Transition ouverture/fermeture plus douce
          "transition-all duration-300 ease-out sm:absolute sm:w-[90vw] sm:h-[80vh] fixed inset-0 w-full h-full sm:inset-auto",
          chatConfig.chatPositions[position],
          chatConfig.dimensions[size],
          isOpen ? chatConfig.states.open : chatConfig.states.closed
        )}
      >
        {/* Header: dégradé primaire + légère ombre */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-b border-border/20 shadow-sm">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <h3 className="font-semibold">Assistant IA</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden text-primary-foreground hover:bg-primary-foreground/15"
            onClick={toggleChat}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages: fond en dégradé subtil */}
        <div className="flex-1 overflow-hidden bg-gradient-to-b from-transparent to-muted/30">
          <ChatMessageList messages={messages} onRemoveAudio={removeAudioFromMessage} />
        </div>

        {/* Indicateur de saisie / traitement */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              className="px-4 py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-fit rounded-full bg-muted px-3 py-1 text-xs shadow-sm">
                <TypingDots />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload queue */}
        <AnimatePresence>
          {audioFiles.length > 0 && (
            <motion.div
              className="p-3 border-t bg-muted/50"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Fichiers audio à envoyer:</p>
                {audioFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-background rounded p-2">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeAudioFile(file.id)} className="h-6 w-6">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recorded preview */}
        <AnimatePresence>
          {audioBlob && !isProcessing && !submittingAudio && (
             <motion.div
               className="p-3 border-t bg-muted/50"
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: "auto", opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
             >
               <AudioPlayer src={URL.createObjectURL(audioBlob)} onRemove={clearRecording} />
             </motion.div>
           )}
</AnimatePresence>

{/* Bandeau de statut pendant l’envoi/transcription */}
<AnimatePresence>
  {submittingAudio && (
    <motion.div
      className="px-4 py-2 border-t bg-muted/60 text-sm text-muted-foreground flex items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
    >
      <span>Traitement de l’audio…</span>
      <TypingDots />
    </motion.div>
  )}
</AnimatePresence>

{/* Input: champs + boutons plus premium */}
        <div className="p-4 border-t border-border/60 bg-card/80 backdrop-blur">
          <div className="relative flex items-center">
            {/* input file masqué */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*"
              multiple
              className="hidden"
            />

            {/* Zone de texte en forme de pill, avec padding pour icônes */}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tapez votre message…"
              className="w-full min-h-[48px] max-h-[160px] resize-none rounded-full
                         bg-background/80 border border-border/60 px-12 pr-28 py-3 text-sm
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              rows={1}
              disabled={isProcessing}
            />

            {/* Bouton + (upload) à l’intérieur, côté gauche */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full
                         hover:bg-muted/60"
              aria-label="Ajouter un fichier audio"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {/* --- Indicateur d’enregistrement --- */}
              {isRecording && (
                <div className="flex items-center gap-2 pr-1" aria-live="polite">
                  <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground tabular-nums">{formatTime(elapsedSeconds)}</span>
                  <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-[width] duration-75"
                      style={{ width: `${Math.min(100, Math.max(6, level * 200))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Toggle Recherche Web */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setUseWeb(v => !v)}
                disabled={isProcessing}
                className={`h-9 w-9 rounded-full hover:bg-muted/60 ${useWeb ? "bg-primary text-primary-foreground" : ""}`}
                aria-pressed={useWeb}
                aria-label="Activer la recherche web"
                title={useWeb ? "Recherche web activée" : "Activer la recherche web"}
              >
                <Globe className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`h-9 w-9 rounded-full hover:bg-muted/60 ${isRecording ? "bg-red-500 text-white hover:bg-red-600" : ""}`}
                aria-label={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
              >
                <Mic className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={(!inputValue.trim() && audioFiles.length === 0 && !audioBlob) || isProcessing || submittingAudio}
                size="icon"
                className="h-9 w-9 rounded-full shadow hover:shadow-md"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle flottant: dégradé + anneau lumineux */}
      <Button
        variant="default"
        onClick={toggleChat}
        className="w-14 h-14 rounded-full shadow-lg hover:shadow-2xl transition-all duration-300
                   bg-gradient-to-br from-primary to-primary/80 text-primary-foreground
                   ring-2 ring-primary/30 hover:ring-primary/50"
      >
        {isOpen ? <X className="h-6 w-6" /> : icon || <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  )
}