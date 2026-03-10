import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TOPIC_SEEDS = [
  { topic: "5 essential safety checks before every heavy duty tow", category: "safety" },
  { topic: "How to properly disconnect a driveshaft for towing", category: "driveline" },
  { topic: "Winter towing tips for heavy duty operators", category: "tips" },
  { topic: "Understanding FMCSA regulations for towing operators in 2024", category: "regulations" },
  { topic: "Rotator vs wheel-lift: choosing the right equipment for the job", category: "equipment" },
  { topic: "Why driveshaft safety cables are critical during heavy duty tows", category: "driveline" },
  { topic: "Top 10 mistakes new tow truck operators make", category: "tips" },
  { topic: "Heavy duty towing insurance: what operators need to know", category: "industry-news" },
  { topic: "DOT inspection preparation guide for tow trucks", category: "regulations" },
  { topic: "How to safely recover an overturned semi-truck", category: "safety" },
  { topic: "Understanding air brake systems on heavy duty vehicles", category: "equipment" },
  { topic: "The history of heavy duty towing in America", category: "industry-news" },
  { topic: "CDL requirements for tow truck operators by state", category: "regulations" },
  { topic: "Night towing safety: essential lighting and visibility tips", category: "safety" },
  { topic: "How to choose the right winch for heavy duty recovery", category: "equipment" },
  { topic: "Fleet management tips for towing companies", category: "tips" },
  { topic: "Common driveline damage during towing and how to prevent it", category: "driveline" },
  { topic: "Accident scene management for tow operators", category: "safety" },
  { topic: "PTO safety and maintenance for tow trucks", category: "equipment" },
  { topic: "How weather affects heavy duty towing operations", category: "tips" },
  { topic: "Understanding towing capacity ratings and weight limits", category: "regulations" },
  { topic: "The importance of proper chain and strap inspection", category: "safety" },
  { topic: "Heavy duty towing industry trends and outlook", category: "industry-news" },
  { topic: "How to start a heavy duty towing business", category: "tips" },
  { topic: "Hydraulic system maintenance for tow trucks", category: "equipment" },
  { topic: "Mountain and steep grade towing techniques", category: "tips" },
  { topic: "Understanding hazmat towing regulations", category: "regulations" },
  { topic: "Best practices for securing loads during transport", category: "safety" },
  { topic: "The role of technology in modern towing operations", category: "industry-news" },
  { topic: "Tire blowout recovery procedures for heavy duty vehicles", category: "safety" },
  { topic: "Diesel engine basics every tow operator should know", category: "equipment" },
  { topic: "How to handle customer disputes in the towing business", category: "tips" },
  { topic: "Bridge weight limits and towing route planning", category: "regulations" },
  { topic: "Heavy duty towing in extreme heat: protecting your equipment", category: "tips" },
  { topic: "Understanding fifth wheel and kingpin connections for towing", category: "driveline" },
  { topic: "Emergency roadside repair tips for tow truck operators", category: "tips" },
  { topic: "How GPS and dispatch software improve towing efficiency", category: "industry-news" },
  { topic: "Proper rigging techniques for heavy duty recovery", category: "safety" },
  { topic: "Transmission protection during long-distance tows", category: "driveline" },
  { topic: "Tow truck operator fatigue: recognizing the signs and staying safe", category: "safety" },
  { topic: "Understanding towing contracts and liability", category: "regulations" },
  { topic: "The benefits of joining a towing association", category: "industry-news" },
  { topic: "Wheel lift vs flatbed: when to use each method", category: "equipment" },
  { topic: "How to properly disconnect an AWD vehicle driveline for towing", category: "driveline" },
  { topic: "Fuel efficiency tips for tow truck operators", category: "tips" },
  { topic: "OSHA safety standards for towing and recovery workers", category: "regulations" },
  { topic: "Building a maintenance schedule for your tow truck fleet", category: "equipment" },
  { topic: "The evolution of driveshaft safety equipment in towing", category: "driveline" },
  { topic: "How to handle police and insurance company interactions at accident scenes", category: "tips" },
  { topic: "Heavy equipment transport: permits, routes, and safety", category: "regulations" },
]

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get already-used topic seeds
    const { data: existingPosts } = await supabase
      .from('blog_posts')
      .select('topic_seed')

    const usedTopics = new Set((existingPosts || []).map((p: any) => p.topic_seed))

    // Find an unused topic
    const availableTopics = TOPIC_SEEDS.filter(t => !usedTopics.has(t.topic))

    if (availableTopics.length === 0) {
      return new Response(
        JSON.stringify({ error: 'All topic seeds have been used. Add more topics or reset.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Pick a random unused topic
    const selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)]

    // Generate content with OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert heavy duty towing and recovery industry writer. You write for K.Todd Driveshaft Cable, a company that makes driveshaft safety cables for heavy duty towing operators.

Write informative, practical blog posts that help professional tow truck operators. Your tone is authoritative but approachable — like an experienced operator sharing knowledge with peers.

IMPORTANT RULES:
- Write 800-1200 words of unique, original content
- Use markdown formatting with ## for H2 headings and ### for H3 subheadings
- Include practical, actionable advice
- Reference real industry standards (FMCSA, DOT, OSHA) where relevant
- Do NOT mention competitors or specific brand names (except K.Todd when relevant to driveshaft cables)
- Do NOT use AI-sounding phrases like "in today's fast-paced world" or "let's dive in"
- Write in a professional but conversational tone
- Include a brief conclusion with a key takeaway

Respond with valid JSON only, in this exact format:
{
  "title": "SEO-optimized title (60 chars max)",
  "excerpt": "Compelling 1-2 sentence summary (160 chars max)",
  "content": "Full markdown article content",
  "meta_description": "SEO meta description (155 chars max)",
  "tags": ["tag1", "tag2", "tag3"]
}`
          },
          {
            role: 'user',
            content: `Write a blog post about: ${selectedTopic.topic}\n\nCategory: ${selectedTopic.category}`
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    })

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text()
      console.error('OpenAI API error:', errText)
      return new Response(
        JSON.stringify({ error: 'Failed to generate content' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const openaiData = await openaiResponse.json()
    const rawContent = openaiData.choices[0].message.content

    // Parse the JSON response (strip markdown code fences if present)
    let parsed
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Failed to parse OpenAI response:', rawContent)
      return new Response(
        JSON.stringify({ error: 'Failed to parse generated content' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const slug = generateSlug(parsed.title)
    const wordCount = parsed.content.split(/\s+/).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))

    // Insert the post
    const { data: newPost, error: insertError } = await supabase
      .from('blog_posts')
      .insert([{
        title: parsed.title,
        slug,
        excerpt: parsed.excerpt,
        content: parsed.content,
        category: selectedTopic.category,
        tags: parsed.tags || [],
        status: 'published',
        topic_seed: selectedTopic.topic,
        meta_description: parsed.meta_description,
        reading_time_minutes: readingTime,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save post', details: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Generated blog post: "${parsed.title}" (${slug})`)

    return new Response(
      JSON.stringify({ success: true, post: newPost }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
