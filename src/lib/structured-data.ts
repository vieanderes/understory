import { REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

/**
 * schema.org data for search engines: a free course with a provider and a licence is what
 * makes a page eligible for Google's course listings, and it tells AI search what the site is.
 */
type Thing = Record<string, unknown>;

const provider: Thing = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: [REPO_URL],
};

const free: Thing = { '@type': 'Offer', category: 'Free', price: 0, priceCurrency: 'EUR' };

const LICENCE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

const onlineInstance = (minutes?: number): Thing => ({
  '@type': 'CourseInstance',
  courseMode: 'Online',
  courseWorkload: minutes ? `PT${Math.max(1, Math.round(minutes / 60))}H` : undefined,
});

export function siteData(): Thing {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: 'en-GB',
      },
      {
        '@type': 'Course',
        '@id': `${SITE_URL}/#course`,
        name: 'Understory: software engineering, from first program to production',
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        provider,
        offers: free,
        isAccessibleForFree: true,
        license: LICENCE,
        inLanguage: 'en-GB',
        hasCourseInstance: onlineInstance(),
      },
    ],
  };
}

export function pathData(path: {
  id: string;
  name: string;
  summary: string;
  outcomes: string[];
  minutes: number;
}): Thing {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: path.name,
    description: path.summary,
    url: `${SITE_URL}/paths/${path.id}`,
    teaches: path.outcomes,
    provider,
    offers: free,
    isAccessibleForFree: true,
    license: LICENCE,
    inLanguage: 'en-GB',
    hasCourseInstance: onlineInstance(path.minutes),
    isPartOf: { '@id': `${SITE_URL}/#course` },
  };
}

export function lessonData(lesson: { title: string; objective: string; href: string }): Thing {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: lesson.title,
    description: lesson.objective,
    url: `${SITE_URL}${lesson.href}`,
    learningResourceType: 'Lesson',
    educationalUse: 'practice',
    isAccessibleForFree: true,
    license: LICENCE,
    inLanguage: 'en-GB',
    provider,
    isPartOf: { '@id': `${SITE_URL}/#course` },
  };
}
