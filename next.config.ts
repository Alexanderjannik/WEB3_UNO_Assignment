import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
  async rewrites()
  {
    return [{
      source: '/graphql',
      destination: process.env.GRAPHQL_HTTP_URL ?? 'http://localhost:4000/graphql'
    }]
  }
}

export default nextConfig
