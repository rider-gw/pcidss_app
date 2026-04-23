import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        '@aws-amplify/auth/cognito',
        '@aws-amplify/ui-react',
        '@aws-amplify/auth',
        '@aws-amplify/data-schema/runtime'
      ]
    }
  }
})
