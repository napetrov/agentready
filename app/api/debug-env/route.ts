import { NextResponse } from 'next/server'

export async function GET() {
  const envVars = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'undefined',
    OPENAI_API_KEY_LENGTH: process.env.OPENAI_API_KEY?.length || 0,
    NODE_ENV: process.env.NODE_ENV,
    allOpenaiVars: Object.keys(process.env).filter(key => key.includes('OPENAI')),
    allApiVars: Object.keys(process.env).filter(key => key.includes('API')),
    allKeyVars: Object.keys(process.env).filter(key => key.includes('KEY'))
  }
  
  return NextResponse.json(envVars)
}