#!/usr/bin/env node

/**
 * Simple test runner that bypasses PostCSS issues
 * Runs tests without CSS processing
 */

const { execSync } = require('child_process')
const path = require('path')

console.log('🧪 Running Scrappers Cup Test Suite...\n')

try {
  // Set environment variables to skip PostCSS
  process.env.NODE_ENV = 'test'
  process.env.VITEST = 'true'
  
  // Run vitest with specific configuration
  const command = 'npx vitest run --config vitest.config.ts --reporter=verbose'
  
  console.log('Running command:', command)
  console.log('─'.repeat(50))
  
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VITEST: 'true'
    }
  })
  
  console.log('\n✅ All tests passed!')
  
} catch (error) {
  console.error('\n❌ Tests failed:', error.message)
  process.exit(1)
}