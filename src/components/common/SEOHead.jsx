import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Driveshaft Cable'
const SITE_URL = 'https://driveshaftcable.com'
const DEFAULT_DESCRIPTION = 'Heavy-duty driveshaft safety cables for towing. 3000lb WLL, galvanized steel, aluminum couplers. Made by a heavy duty operator for the heavy duty operator.'
const DEFAULT_IMAGE = `${SITE_URL}/logos/main-logo.png`

function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  canonical,
  ogImage = DEFAULT_IMAGE,
  noindex = false,
  structuredData,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data — supports single object or array of objects */}
      {structuredData && (
        Array.isArray(structuredData)
          ? structuredData.map((data, i) => (
              <script key={i} type="application/ld+json">
                {JSON.stringify(data)}
              </script>
            ))
          : <script type="application/ld+json">
              {JSON.stringify(structuredData)}
            </script>
      )}
    </Helmet>
  )
}

export default SEOHead
