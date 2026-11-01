// Normalize only the public projection returned by get_public_testimonials.
// Approval and permission are enforced in the database, not by browser filters.
export function publicTestimonials(rows) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row.display_name === 'string' && row.display_name.trim() &&
    typeof row.testimonial_text === 'string' && row.testimonial_text.trim())
    .slice(0, 6).map(row => ({ id: row.id, display_name: row.display_name.trim(), testimonial_text: row.testimonial_text.trim() }))
}
