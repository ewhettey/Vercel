import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        // Fetch profile in background; don't block UI
        fetchUserProfile(session.user)
      }
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          // Fetch profile in background; don't block UI
          fetchUserProfile(session.user)
        } else {
          setUser(null)
          setUserProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userObj) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userObj.id)
        .single()

      if (error) {
        // PGRST116 occurs when .single() finds 0 rows (406 Not Acceptable)
        if (error.code === 'PGRST116') {
          // Create a default profile for this user
          const defaultName = userObj.user_metadata?.name || userObj.email?.split('@')[0] || ''
          const { data: inserted, error: upsertError } = await supabase
            .from('users')
            .upsert({ id: userObj.id, name: defaultName, email: userObj.email, role: 'Usher' })
            .select()
            .single()

          if (upsertError) {
            console.error('Error creating user profile:', upsertError)
            return
          }
          setUserProfile(inserted)
          return
        } else {
          console.error('Error fetching user profile:', error)
          return
        }
      }

      setUserProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signInWithMagicLink = async (email) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    return { data, error }
  }

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const updateUserProfile = async (updates) => {
    if (!user) return { error: 'No user logged in' }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (!error && data) {
      setUserProfile(data)
    }

    return { data, error }
  }

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signInWithMagicLink,
    signUp,
    signOut,
    updateUserProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
