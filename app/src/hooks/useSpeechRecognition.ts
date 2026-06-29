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
  const [error, setError] = useState('')
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
    rec.onerror = (e: any) => {
      setListening(false)
      const errType = e?.error || ''
      if (errType === 'not-allowed' || errType === 'service-not-allowed') setError('麦克风权限被拒绝，请在浏览器设置中允许')
      else if (errType === 'no-speech') setError('未检测到语音，请再试一次')
      else if (errType === 'network') setError('网络错误，语音识别需要联网')
      else setError('语音识别出错：' + errType)
    }
    rec.onend = () => setListening(false)
    return rec
  }, [supported, lang])

  const start = useCallback(() => {
    setError('')
    const rec = getRec()
    if (!rec) return
    try {
      setTranscript('')
      setListening(true)
      rec.start()
      recRef.current = rec
    } catch {
      setListening(false)
      setError('启动语音识别失败，可能已在运行中')
    }
  }, [getRec])
  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])
  const reset = useCallback(() => {
    setTranscript('')
    setListening(false)
    setError('')
  }, [])

  useEffect(() => () => { recRef.current?.stop() }, [])

  return { supported, listening, transcript, error, start, stop, reset }
}
