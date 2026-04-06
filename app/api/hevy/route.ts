import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get('apiKey')
  const page = request.nextUrl.searchParams.get('page') || '1'
  const pageSize = request.nextUrl.searchParams.get('pageSize') || '20'

  if (!apiKey) {
    return NextResponse.json({ error: 'No API key provided' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://api.hevyapp.com/v1/workouts?page=${page}&pageSize=${pageSize}`,
      {
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `Hevy API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to Hevy' },
      { status: 500 }
    )
  }
}
