import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        ws: true
      }
    }
  }
})
