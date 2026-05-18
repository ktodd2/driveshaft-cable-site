import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TOPIC_SEEDS = [
  // === SAFETY (20) ===
  { topic: "5 essential safety checks before every heavy duty tow", category: "safety" },
  { topic: "How to safely recover an overturned semi-truck", category: "safety" },
  { topic: "Night towing safety: essential lighting and visibility tips", category: "safety" },
  { topic: "Accident scene management for tow operators", category: "safety" },
  { topic: "The importance of proper chain and strap inspection", category: "safety" },
  { topic: "Best practices for securing loads during transport", category: "safety" },
  { topic: "Tire blowout recovery procedures for heavy duty vehicles", category: "safety" },
  { topic: "Proper rigging techniques for heavy duty recovery", category: "safety" },
  { topic: "Tow truck operator fatigue: recognizing the signs and staying safe", category: "safety" },
  { topic: "Pre-trip inspection checklist for heavy duty tow trucks", category: "safety" },
  { topic: "The role of spotter signals in heavy recovery", category: "safety" },
  { topic: "Heat stress prevention for tow operators", category: "safety" },
  { topic: "Night shift safety protocols for tow operators", category: "safety" },
  { topic: "Preventing back injuries during heavy recovery", category: "safety" },
  { topic: "Radio communication best practices for tow teams", category: "safety" },
  { topic: "Towing damaged vehicles from accident scenes safely", category: "safety" },
  { topic: "Fire safety and extinguisher requirements for tow trucks", category: "safety" },
  { topic: "Handling hazardous materials during vehicle recovery", category: "safety" },
  { topic: "How to handle roadside emergencies safely", category: "safety" },
  { topic: "Personal protective equipment essentials for tow operators", category: "safety" },

  // === EQUIPMENT (16) ===
  { topic: "Rotator vs wheel-lift: choosing the right equipment for the job", category: "equipment" },
  { topic: "Understanding air brake systems on heavy duty vehicles", category: "equipment" },
  { topic: "How to choose the right winch for heavy duty recovery", category: "equipment" },
  { topic: "PTO safety and maintenance for tow trucks", category: "equipment" },
  { topic: "Hydraulic system maintenance for tow trucks", category: "equipment" },
  { topic: "Diesel engine basics every tow operator should know", category: "equipment" },
  { topic: "Wheel lift vs flatbed: when to use each method", category: "equipment" },
  { topic: "Building a maintenance schedule for your tow truck fleet", category: "equipment" },
  { topic: "How to properly use a snatch block for recovery", category: "equipment" },
  { topic: "Choosing the right tow truck for your business", category: "equipment" },
  { topic: "Synthetic vs wire rope winch lines compared", category: "equipment" },
  { topic: "Proper use of wheel straps and axle straps", category: "equipment" },
  { topic: "Choosing between steel and aluminum tow bodies", category: "equipment" },
  { topic: "GPS fleet tracking systems for tow companies", category: "equipment" },
  { topic: "Proper tire chain installation for tow trucks", category: "equipment" },
  { topic: "Air ride suspension maintenance for tow trucks", category: "equipment" },

  // === DRIVELINE (12) ===
  { topic: "How to properly disconnect a driveshaft for towing", category: "driveline" },
  { topic: "Why driveshaft safety cables are critical during heavy duty tows", category: "driveline" },
  { topic: "Common driveline damage during towing and how to prevent it", category: "driveline" },
  { topic: "Understanding fifth wheel and kingpin connections for towing", category: "driveline" },
  { topic: "Transmission protection during long-distance tows", category: "driveline" },
  { topic: "How to properly disconnect an AWD vehicle driveline for towing", category: "driveline" },
  { topic: "The evolution of driveshaft safety equipment in towing", category: "driveline" },
  { topic: "Driveshaft U-joint failure causes and prevention", category: "driveline" },
  { topic: "Driveshaft slip yoke damage during towing", category: "driveline" },
  { topic: "Carrier bearing damage prevention during tows", category: "driveline" },
  { topic: "CV joint protection during flatbed towing", category: "driveline" },
  { topic: "Transfer case disconnect procedures for towing", category: "driveline" },

  // === TIPS (20) ===
  { topic: "Winter towing tips for heavy duty operators", category: "tips" },
  { topic: "Top 10 mistakes new tow truck operators make", category: "tips" },
  { topic: "Fleet management tips for towing companies", category: "tips" },
  { topic: "How weather affects heavy duty towing operations", category: "tips" },
  { topic: "How to start a heavy duty towing business", category: "tips" },
  { topic: "Mountain and steep grade towing techniques", category: "tips" },
  { topic: "How to handle customer disputes in the towing business", category: "tips" },
  { topic: "Heavy duty towing in extreme heat: protecting your equipment", category: "tips" },
  { topic: "Emergency roadside repair tips for tow truck operators", category: "tips" },
  { topic: "Fuel efficiency tips for tow truck operators", category: "tips" },
  { topic: "How to handle police and insurance company interactions at accident scenes", category: "tips" },
  { topic: "Backing techniques for tow trucks in tight spaces", category: "tips" },
  { topic: "Towing electric and hybrid vehicles safely", category: "tips" },
  { topic: "How to manage cash flow in a towing company", category: "tips" },
  { topic: "Working with law enforcement on accident scenes", category: "tips" },
  { topic: "Marketing your towing business on a budget", category: "tips" },
  { topic: "Towing from parking garages and tight structures", category: "tips" },
  { topic: "How to write effective towing invoices", category: "tips" },
  { topic: "How to train new tow truck operators", category: "tips" },
  { topic: "Customer service tips for towing operators", category: "tips" },

  // === REGULATIONS (16) ===
  { topic: "Understanding FMCSA regulations for towing operators in 2024", category: "regulations" },
  { topic: "DOT inspection preparation guide for tow trucks", category: "regulations" },
  { topic: "CDL requirements for tow truck operators by state", category: "regulations" },
  { topic: "Understanding towing capacity ratings and weight limits", category: "regulations" },
  { topic: "Understanding hazmat towing regulations", category: "regulations" },
  { topic: "Bridge weight limits and towing route planning", category: "regulations" },
  { topic: "Understanding towing contracts and liability", category: "regulations" },
  { topic: "OSHA safety standards for towing and recovery workers", category: "regulations" },
  { topic: "Heavy equipment transport: permits, routes, and safety", category: "regulations" },
  { topic: "Understanding electronic logging device ELD requirements", category: "regulations" },
  { topic: "Load securement rules under FMCSA 49 CFR 393", category: "regulations" },
  { topic: "Understanding gross vehicle weight ratings for towing", category: "regulations" },
  { topic: "Tow truck lighting regulations by state", category: "regulations" },
  { topic: "Understanding motor carrier authority for towing", category: "regulations" },
  { topic: "Understanding towing lien laws by state", category: "regulations" },
  { topic: "Towing auction and impound lot regulations", category: "regulations" },

  // === INDUSTRY NEWS (16) ===
  { topic: "Heavy duty towing insurance: what operators need to know", category: "industry-news" },
  { topic: "The history of heavy duty towing in America", category: "industry-news" },
  { topic: "Heavy duty towing industry trends and outlook", category: "industry-news" },
  { topic: "The role of technology in modern towing operations", category: "industry-news" },
  { topic: "How GPS and dispatch software improve towing efficiency", category: "industry-news" },
  { topic: "The benefits of joining a towing association", category: "industry-news" },
  { topic: "How autonomous vehicles will impact towing", category: "industry-news" },
  { topic: "Body camera use in the towing industry", category: "industry-news" },
  { topic: "The impact of electric vehicles on towing", category: "industry-news" },
  { topic: "Towing industry salary and career outlook", category: "industry-news" },
  { topic: "The future of heavy duty towing technology", category: "industry-news" },
  { topic: "Dash cam benefits for tow truck operators", category: "industry-news" },
  { topic: "Social media marketing for towing businesses", category: "industry-news" },
  { topic: "Protecting differentials during long-distance tows", category: "industry-news" },
  { topic: "Rollback bed maintenance and operation tips", category: "industry-news" },
  { topic: "Building relationships with repair shops and dealerships", category: "industry-news" },
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

    // Find an unused topic, or recycle if all used
    const availableTopics = TOPIC_SEEDS.filter(t => !usedTopics.has(t.topic))
    let selectedTopic: { topic: string; category: string }
    let isRecycled = false

    if (availableTopics.length > 0) {
      selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)]
    } else {
      // Recycle: pick a random topic and write with a fresh angle
      selectedTopic = TOPIC_SEEDS[Math.floor(Math.random() * TOPIC_SEEDS.length)]
      isRecycled = true
    }

    // Build the prompt
    const recycleInstruction = isRecycled
      ? `\n\nIMPORTANT: This topic has been covered before on the blog. Write a COMPLETELY NEW article with a different angle, fresh examples, updated information, and a unique perspective. Do NOT repeat previous content.`
      : ''

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
            content: `You are an expert heavy duty towing and recovery industry writer. You write for Driveshaft Cable, a company that makes driveshaft safety cables for heavy duty towing operators.

Write informative, practical blog posts that help professional tow truck operators. Your tone is authoritative but approachable — like an experienced operator sharing knowledge with peers.

IMPORTANT RULES:
- Write 800-1200 words of unique, original content
- Use markdown formatting with ## for H2 headings and ### for H3 subheadings
- Include practical, actionable advice
- Reference real industry standards (FMCSA, DOT, OSHA) where relevant
- Do NOT mention competitors or specific brand names (except Driveshaft Cable when relevant)
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
            content: `Write a blog post about: ${selectedTopic.topic}\n\nCategory: ${selectedTopic.category}${recycleInstruction}`
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

    let slug = generateSlug(parsed.title)
    const wordCount = parsed.content.split(/\s+/).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))

    // If recycled, ensure unique slug by appending a number
    if (isRecycled) {
      const { count } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .like('slug', `${slug}%`)
      if (count && count > 0) {
        slug = `${slug}-${count + 1}`
      }
    }

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
        topic_seed: isRecycled ? `${selectedTopic.topic} (recycled)` : selectedTopic.topic,
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

    console.log(`Generated blog post: "${parsed.title}" (${slug})${isRecycled ? ' [recycled topic]' : ''}`)

    // Auto-post to Facebook (best-effort, don't block on failure)
    try {
      const fbToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')

      if (fbToken) {
        const postUrl = `https://driveshaftcable.com/blog/${slug}`
        const fbMessage = `New on the blog: ${parsed.title}\n\n${parsed.excerpt}\n\nRead more:`

        const fbResponse = await fetch(
          `https://graph.facebook.com/v25.0/me/feed`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: fbMessage,
              link: postUrl,
              access_token: fbToken,
            }),
          }
        )

        if (fbResponse.ok) {
          const fbData = await fbResponse.json()
          console.log(`Posted to Facebook: ${fbData.id}`)
        } else {
          const fbErr = await fbResponse.text()
          console.error('Facebook post failed:', fbErr)
        }
      }
    } catch (fbError) {
      console.error('Facebook posting error:', fbError)
    }

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
