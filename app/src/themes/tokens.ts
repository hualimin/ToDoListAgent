export type ThemeId = 'botanical' | 'paper' | 'swiss' | 'bright'
export type Variant = 'stamp' | 'dot' | 'gradient'

export interface ThemeTokens {
  id: ThemeId; name: string
  bg: string; bg2: string; card: string
  ink: string; ink2: string; ink3: string; line: string
  accent: string; done: string; late: string; urgent: string
  fontDisplay: string; fontBody: string
  cardRadius: string; pillRadius: string
  variant: Variant
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  botanical: { id:'botanical', name:'自然手作', bg:'#F5F1E8', bg2:'#EFE9DA', card:'#FBF8F0', ink:'#2E3A2E', ink2:'#5E6B58', ink3:'#9AA28E', line:'#E2DAC4', accent:'#6B8E5A', done:'#6B8E5A', late:'#D4B063', urgent:'#C17A54', fontDisplay:"'Fraunces', serif", fontBody:"'Nunito', sans-serif", cardRadius:'24px', pillRadius:'999px', variant:'dot' },
  paper:     { id:'paper', name:'纸本日记', bg:'#F6EFE1', bg2:'#FCF8EF', card:'#FBF6EA', ink:'#24211C', ink2:'#6E6557', ink3:'#A89F8E', line:'#E3D9C4', accent:'#B23A2D', done:'#4E6E54', late:'#A9791C', urgent:'#B23A2D', fontDisplay:"'Newsreader','LXGW WenKai Screen',serif", fontBody:"'LXGW WenKai Screen',serif", cardRadius:'14px', pillRadius:'7px', variant:'stamp' },
  swiss:     { id:'swiss', name:'瑞士极简', bg:'#FFFFFF', bg2:'#F4F4F2', card:'#FFFFFF', ink:'#0A0A0A', ink2:'#525252', ink3:'#A3A3A3', line:'#E5E5E5', accent:'#2563EB', done:'#16A34A', late:'#D97706', urgent:'#2563EB', fontDisplay:"'Inter',sans-serif", fontBody:"'Inter',sans-serif", cardRadius:'0px', pillRadius:'0px', variant:'dot' },
  bright:    { id:'bright', name:'明快活力', bg:'#FFFBF5', bg2:'#FFFFFF', card:'#FFFFFF', ink:'#1F1B16', ink2:'#6B6258', ink3:'#A89E92', line:'#F0E6D6', accent:'#FF6B5B', done:'#2BB673', late:'#FFB23E', urgent:'#FF6B5B', fontDisplay:"'Plus Jakarta Sans',sans-serif", fontBody:"'Plus Jakarta Sans',sans-serif", cardRadius:'20px', pillRadius:'999px', variant:'gradient' },
}
export const DEFAULT_THEME: ThemeId = 'botanical'
