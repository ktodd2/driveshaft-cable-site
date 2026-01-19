# Driveshaft Cable by K.Todd - Website

Heavy-duty driveshaft safety cable product website with quote request functionality.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (for form submissions)
- **Hosting**: Render (Static Site)

## Setup

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run this query to create the quote_requests table:

```sql
CREATE TABLE quote_requests (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  quantity INTEGER,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'new'
);

-- Enable Row Level Security
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for the contact form)
CREATE POLICY "Allow anonymous inserts" ON quote_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read (for admin dashboard)
CREATE POLICY "Allow authenticated reads" ON quote_requests
  FOR SELECT
  TO authenticated
  USING (true);
```

3. Get your project URL and anon key from Settings > API

### 2. Local Development

```bash
# Install dependencies
npm install

# Create .env file with your Supabase credentials
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Start dev server
npm run dev
```

### 3. Deploy to Render

1. Push code to GitHub
2. Connect repo to Render as a Static Site
3. Set build command: `npm install && npm run build`
4. Set publish directory: `dist`
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Project Structure

```
driveshaft-cable-site/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Hero.jsx
│   │   ├── Problem.jsx
│   │   ├── Product.jsx
│   │   ├── Specs.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── Customers.jsx
│   │   ├── QuoteForm.jsx
│   │   └── Footer.jsx
│   ├── lib/
│   │   └── supabase.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── render.yaml
└── README.md
```

## Features

- Responsive design (mobile-first)
- Industrial/aggressive styling matching K.Todd brand
- Quote request form with Supabase storage
- SEO optimized
- Fast loading with Vite

## Contact

houstontruckwreck@gmail.com
