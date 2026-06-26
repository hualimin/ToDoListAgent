import { useState, useRef, useCallback, useEffect } from 'react'

// Web Speech API 类型（非标准 TS lib）
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

export function useSpeechRecognition(lang = 'zh-CN') {
  const [supported] = useState(() =>
    typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  )
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const getRec = useCallback((): SpeechRecognitionLike | null => {
    if (!supported) return null
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript
      setTranscript(txt)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    return rec
  }, [supported, lang])

  const start = useCallback(() => {
    const rec = getRec()
    if (!rec) return
    setTranscript('')
    setListening(true)
    rec.start()
    recRef.current = rec
  }, [getRec])
  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])
  const reset = useCallback(() => {
    setTranscript('')
    setListening(false)
  }, [])

  useEffect(() => () => { recRef.current?.stop() }, [])

  return { supported, listening, transcript, start, stop, reset }
}
