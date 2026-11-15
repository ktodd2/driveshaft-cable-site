// Retired public endpoint. Notifications are exclusively sent by submit-quote
// after validated, atomic persistence. Never trust legacy arbitrary email bodies.
Deno.serve(() => new Response(JSON.stringify({ error: 'Please refresh the website and submit your request again.' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
}))
