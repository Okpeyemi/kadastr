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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white", isUser ? "bg-primary" : "bg-secondary")}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="space-y-2">
        {message.content && (
          <div className={cn("rounded-lg px-3 py-2 text-sm", isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {message.content}
          </div>
        )}
        {message.audioFile && <AudioPlayer src={message.audioFile} onRemove={() => onRemoveAudio?.(message.id)} />}
        <div className="text-xs text-muted-foreground" suppressHydrationWarning>{formatTime(message.timestamp)}</div>
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
  // const [isPending, startTransition] = useTransition()
  const [, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isRecording, audioBlob, startRecording, stopRecording, clearRecording, level, elapsedSeconds } = useVoiceRecorder()

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

  const handleSendMessage = () => {
    if (!inputValue.trim() && audioFiles.length === 0 && !audioBlob) return

    const msg: Message = {
      id: `${Date.now()}`,
      content: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
    }

    if (audioBlob) {
      msg.audioFile = URL.createObjectURL(audioBlob)
      clearRecording()
    } else if (audioFiles.length > 0) {
      msg.audioFile = audioFiles[0].url
      setAudioFiles([])
    }

    setMessages((prev) => [...prev, msg])
    setInputValue("")
    setIsProcessing(true)

    startTransition(() => {
      setTimeout(() => {
        const ai: Message = {
          id: `${Date.now() + 1}`,
          content:
            "J’ai reçu votre message." + (msg.audioFile ? " Et votre fichier audio également." : "") + " Comment puis-je vous aider ?",
          sender: "ai",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, ai])
        setIsProcessing(false)
      }, 1000)
    })
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
              <div className="w-fit rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs shadow-sm">
                L’assistant rédige…
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
          {audioBlob && (
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

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`h-9 w-9 rounded-full hover:bg-muted/60 ${
                  isRecording ? "bg-red-500 text-white hover:bg-red-600" : ""
                }`}
                aria-label={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
              >
                <Mic className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={(!inputValue.trim() && audioFiles.length === 0 && !audioBlob) || isProcessing}
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