import { Button, Paper, PasswordInput, Text, TextInput, Title, Anchor, Stack, Alert } from '@mantine/core'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useSupabaseAuth } from '@/stores/supabaseAuthStore'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signInWithEmail, signUpWithEmail, loading } = useSupabaseAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = isSignUp
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password)

    if (result.error) {
      setError(result.error)
    } else {
      navigate({ to: '/' })
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--chatbox-background-secondary, #f5f5f5)',
      }}
    >
      <Paper shadow="md" p="xl" radius="md" style={{ width: 400, maxWidth: '90vw' }}>
        <Title order={2} ta="center" mb="md">
          ChatBridge
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="lg">
          {isSignUp ? 'Create an account to get started' : 'Sign in to continue'}
        </Text>

        {error && (
          <Alert color="red" mb="md" variant="light">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              type="email"
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={6}
            />
            <Button type="submit" fullWidth loading={loading}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </Stack>
        </form>

        <Text c="dimmed" size="sm" ta="center" mt="md">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <Anchor
            component="button"
            type="button"
            size="sm"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </Anchor>
        </Text>
      </Paper>
    </div>
  )
}
