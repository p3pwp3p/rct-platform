'use client'
import {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

// ─── Context 타입 ─────────────────────────────────────────────────────────────
interface ProfileContextValue {
  /** 로그인 유저가 소유한 모든 계좌 목록 */
  profiles: Profile[]
  /** 현재 선택된 계좌 */
  activeProfile: Profile | null
  /** 계좌 선택 */
  setActiveProfileId: (id: string) => void
  /** 목록 로딩 중 */
  loading: boolean
  /** 프로필 목록 새로고침 */
  refresh: () => void
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  activeProfile: null,
  setActiveProfileId: () => {},
  loading: true,
  refresh: () => {},
})

// ─── Provider ────────────────────────────────────────────────────────────────
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // 자신의 계좌 + owner_id가 자신인 아바타 계좌 모두 로드
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`id.eq.${user.id},owner_id.eq.${user.id}`)
      .order('created_at', { ascending: true })

    const list = (data ?? []) as Profile[]
    setProfiles(list)

    // 이전에 선택한 계좌 복원 (없으면 첫 번째)
    const saved   = typeof window !== 'undefined' ? localStorage.getItem('rct_active_profile') : null
    const found   = list.find(p => p.id === saved) ?? list[0]
    if (found) setActiveId(found.id)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setActiveProfileId = (id: string) => {
    setActiveId(id)
    if (typeof window !== 'undefined') localStorage.setItem('rct_active_profile', id)
  }

  const activeProfile = profiles.find(p => p.id === activeId) ?? null

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, setActiveProfileId, loading, refresh: load }}>
      {children}
    </ProfileContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useProfile() {
  return useContext(ProfileContext)
}
