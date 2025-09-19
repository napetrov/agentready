/**
 * Business Type Analyzer
 * 
 * Analyzes websites for AI agent readiness based on business type and agentic flows.
 * Focuses only on information that AI agents need to perform their tasks.
 */

export type BusinessType = 
  | 'food_service' 
  | 'hospitality' 
  | 'travel' 
  | 'healthcare' 
  | 'professional_services'
  | 'retail_ecommerce'
  | 'home_services'
  | 'beauty_wellness'
  | 'events_experiences'
  | 'fitness_wellness'
  | 'pet_services'
  | 'automotive'
  | 'education'
  | 'financial_services'
  | 'technology_software'
  | 'unknown';

/**
 * Check if location information is relevant for a business type
 */
export function isLocationRelevant(businessType: BusinessType): boolean {
  const locationRelevantTypes: BusinessType[] = [
    'food_service',
    'healthcare', 
    'retail_ecommerce',
    'hospitality',
    'automotive',
    'home_services',
    'beauty_wellness',
    'events_experiences',
    'fitness_wellness',
    'pet_services'
  ]
  return locationRelevantTypes.includes(businessType)
}

export interface BusinessTypeConfig {
  type: BusinessType;
  displayName: string;
  keywords: string[];
  agenticFlowWeights: {
    informationGathering: number;
    directBooking: number;
    faqSupport: number;
    taskManagement: number;
    personalization: number;
  };
  requiredInformation: {
    [key: string]: {
      weight: number;
      description: string;
      examples: string[];
    };
  };
}

export interface AgenticFlowAnalysis {
  informationGathering: {
    score: number;
    details: {
      hasServiceProductInfo: boolean;
      hasPricing: boolean;
      hasAvailability: boolean;
      hasContactInfo: boolean;
      hasLocation: boolean;
      hasReviews: boolean;
      hasPolicies: boolean;
      hasDifferentiators: boolean;
    };
  };
  directBooking: {
    score: number;
    details: {
      hasActionableInstructions: boolean;
      hasBookingRequirements: boolean;
      hasConfirmationProcess: boolean;
      hasPaymentOptions: boolean;
      hasModificationPolicies: boolean;
      hasErrorHandling: boolean;
    };
  };
  faqSupport: {
    score: number;
    details: {
      hasFaq: boolean;
      hasPolicyDocumentation: boolean;
      hasUserGuides: boolean;
      hasEligibilityCriteria: boolean;
      hasSupportContact: boolean;
      hasSearchFunctionality: boolean;
    };
  };
  taskManagement: {
    score: number;
    details: {
      hasScheduleVisibility: boolean;
      hasReservationManagement: boolean;
      hasTaskTracking: boolean;
      hasReschedulingProcess: boolean;
      hasMembershipDetails: boolean;
      hasNotificationSystems: boolean;
    };
  };
  personalization: {
    score: number;
    details: {
      hasPersonalizationData: boolean;
      hasRecommendationLogic: boolean;
      hasContextAwareness: boolean;
      hasUserProfiling: boolean;
      hasDynamicContent: boolean;
    };
  };
}

export interface AIAgentReadinessResult {
  businessType: BusinessType;
  businessTypeConfidence: number;
  overallScore: number;
  agenticFlows: AgenticFlowAnalysis;
  aiRelevantChecks: {
    hasStructuredData: boolean;
    hasContactInfo: boolean;
    hasPageTitle: boolean;
    hasMetaDescription: boolean;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    contentAccessibility: number; // 0-100, how easy it is for AI to extract info
  };
  findings: string[];
  recommendations: string[];
}

// Business type configurations
export const BUSINESS_TYPE_CONFIGS: Record<BusinessType, BusinessTypeConfig> = {
  food_service: {
    type: 'food_service',
    displayName: 'Food Service',
    keywords: ['restaurant', 'food', 'menu', 'dining', 'delivery', 'takeout', 'catering', 'bar', 'cafe', 'bistro'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.30,
      faqSupport: 0.15,
      taskManagement: 0.20,
      personalization: 0.10,
    },
    requiredInformation: {
      menu: { weight: 25, description: 'Menu items and descriptions', examples: ['food items', 'prices', 'ingredients', 'allergens'] },
      hours: { weight: 20, description: 'Operating hours', examples: ['open hours', 'closed days', 'holiday hours'] },
      location: { weight: 20, description: 'Location and contact', examples: ['address', 'phone', 'directions'] },
      booking: { weight: 20, description: 'Reservation/ordering options', examples: ['reservations', 'online ordering', 'delivery'] },
      policies: { weight: 15, description: 'Business policies', examples: ['cancellation', 'delivery area', 'payment methods'] },
    },
  },
  hospitality: {
    type: 'hospitality',
    displayName: 'Hospitality',
    keywords: ['hotel', 'motel', 'resort', 'inn', 'bed', 'breakfast', 'accommodation', 'lodging'],
    agenticFlowWeights: {
      informationGathering: 0.20,
      directBooking: 0.35,
      faqSupport: 0.15,
      taskManagement: 0.20,
      personalization: 0.10,
    },
    requiredInformation: {
      rooms: { weight: 25, description: 'Room types and amenities', examples: ['room types', 'amenities', 'pricing', 'availability'] },
      location: { weight: 20, description: 'Location and contact', examples: ['address', 'phone', 'directions', 'nearby attractions'] },
      booking: { weight: 25, description: 'Reservation system', examples: ['online booking', 'check-in/out', 'cancellation policy'] },
      services: { weight: 20, description: 'Hotel services', examples: ['wifi', 'parking', 'restaurant', 'spa', 'concierge'] },
      policies: { weight: 10, description: 'Hotel policies', examples: ['pet policy', 'smoking policy', 'age restrictions'] },
    },
  },
  travel: {
    type: 'travel',
    displayName: 'Travel',
    keywords: ['travel', 'trip', 'vacation', 'tour', 'flight', 'cruise', 'adventure', 'tourism'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.30,
      faqSupport: 0.20,
      taskManagement: 0.15,
      personalization: 0.10,
    },
    requiredInformation: {
      destinations: { weight: 25, description: 'Travel destinations and packages', examples: ['destinations', 'packages', 'itineraries', 'pricing'] },
      booking: { weight: 25, description: 'Booking system', examples: ['online booking', 'payment options', 'cancellation policy'] },
      information: { weight: 25, description: 'Travel information', examples: ['visa requirements', 'weather', 'what to pack', 'local customs'] },
      support: { weight: 15, description: 'Customer support', examples: ['24/7 support', 'emergency contact', 'travel insurance'] },
      reviews: { weight: 10, description: 'Customer reviews', examples: ['tripadvisor', 'google reviews', 'testimonials'] },
    },
  },
  healthcare: {
    type: 'healthcare',
    displayName: 'Healthcare',
    keywords: ['doctor', 'medical', 'health', 'clinic', 'hospital', 'dentist', 'therapy', 'wellness', 'pharmacy'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.25,
      faqSupport: 0.25,
      taskManagement: 0.20,
      personalization: 0.05,
    },
    requiredInformation: {
      services: { weight: 25, description: 'Medical services offered', examples: ['specialties', 'procedures', 'treatments', 'consultations'] },
      providers: { weight: 20, description: 'Healthcare providers', examples: ['doctors', 'credentials', 'experience', 'languages'] },
      booking: { weight: 20, description: 'Appointment booking', examples: ['online scheduling', 'availability', 'insurance accepted'] },
      location: { weight: 15, description: 'Location and contact', examples: ['address', 'phone', 'hours', 'directions'] },
      insurance: { weight: 20, description: 'Insurance and billing', examples: ['accepted insurance', 'payment options', 'billing policies'] },
    },
  },
  professional_services: {
    type: 'professional_services',
    displayName: 'Professional Services',
    keywords: ['lawyer', 'attorney', 'legal', 'accountant', 'consultant', 'advisor', 'professional', 'services'],
    agenticFlowWeights: {
      informationGathering: 0.30,
      directBooking: 0.15,
      faqSupport: 0.25,
      taskManagement: 0.20,
      personalization: 0.10,
    },
    requiredInformation: {
      expertise: { weight: 30, description: 'Professional expertise', examples: ['practice areas', 'specialties', 'experience', 'credentials'] },
      contact: { weight: 25, description: 'Contact information', examples: ['phone', 'email', 'office location', 'consultation availability'] },
      process: { weight: 25, description: 'Service process', examples: ['consultation process', 'fees', 'timeline', 'what to expect'] },
      credentials: { weight: 20, description: 'Professional credentials', examples: ['education', 'certifications', 'bar admissions', 'memberships'] },
    },
  },
  retail_ecommerce: {
    type: 'retail_ecommerce',
    displayName: 'Retail & E-commerce',
    keywords: ['shop', 'store', 'retail', 'ecommerce', 'products', 'buy', 'sell', 'merchandise'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.25,
      faqSupport: 0.20,
      taskManagement: 0.15,
      personalization: 0.15,
    },
    requiredInformation: {
      products: { weight: 30, description: 'Product catalog', examples: ['product listings', 'descriptions', 'specifications', 'images'] },
      pricing: { weight: 20, description: 'Pricing and offers', examples: ['prices', 'sales', 'discounts', 'shipping costs'] },
      purchasing: { weight: 25, description: 'Purchase process', examples: ['cart', 'checkout', 'payment options', 'shipping options'] },
      support: { weight: 25, description: 'Customer support', examples: ['returns', 'warranty', 'customer service', 'FAQ'] },
    },
  },
  home_services: {
    type: 'home_services',
    displayName: 'Home Services',
    keywords: ['cleaning', 'plumbing', 'electrical', 'hvac', 'repair', 'maintenance', 'contractor', 'handyman'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.30,
      faqSupport: 0.20,
      taskManagement: 0.20,
      personalization: 0.05,
    },
    requiredInformation: {
      services: { weight: 25, description: 'Services offered', examples: ['service types', 'pricing', 'coverage area', 'response time'] },
      booking: { weight: 30, description: 'Service booking', examples: ['online booking', 'scheduling', 'availability', 'emergency services'] },
      credentials: { weight: 20, description: 'Service credentials', examples: ['licenses', 'insurance', 'certifications', 'reviews'] },
      contact: { weight: 25, description: 'Contact information', examples: ['phone', 'email', 'service area', 'emergency contact'] },
    },
  },
  beauty_wellness: {
    type: 'beauty_wellness',
    displayName: 'Beauty & Wellness',
    keywords: ['salon', 'spa', 'beauty', 'wellness', 'massage', 'hair', 'nail', 'skincare', 'fitness'],
    agenticFlowWeights: {
      informationGathering: 0.20,
      directBooking: 0.30,
      faqSupport: 0.15,
      taskManagement: 0.25,
      personalization: 0.10,
    },
    requiredInformation: {
      services: { weight: 25, description: 'Services and treatments', examples: ['service menu', 'pricing', 'duration', 'specialties'] },
      staff: { weight: 20, description: 'Staff and expertise', examples: ['staff profiles', 'specialties', 'availability', 'certifications'] },
      booking: { weight: 30, description: 'Appointment booking', examples: ['online booking', 'availability', 'scheduling', 'cancellation policy'] },
      location: { weight: 25, description: 'Location and contact', examples: ['address', 'phone', 'hours', 'parking'] },
    },
  },
  events_experiences: {
    type: 'events_experiences',
    displayName: 'Events & Experiences',
    keywords: ['event', 'party', 'wedding', 'corporate', 'conference', 'experience', 'entertainment', 'venue'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.25,
      faqSupport: 0.20,
      taskManagement: 0.25,
      personalization: 0.05,
    },
    requiredInformation: {
      events: { weight: 25, description: 'Event types and packages', examples: ['event types', 'packages', 'pricing', 'capacity'] },
      venue: { weight: 25, description: 'Venue information', examples: ['venue details', 'amenities', 'location', 'photos'] },
      booking: { weight: 25, description: 'Booking process', examples: ['availability', 'booking process', 'deposits', 'cancellation policy'] },
      services: { weight: 25, description: 'Additional services', examples: ['catering', 'decorations', 'entertainment', 'coordination'] },
    },
  },
  fitness_wellness: {
    type: 'fitness_wellness',
    displayName: 'Fitness & Wellness',
    keywords: ['gym', 'fitness', 'yoga', 'pilates', 'personal training', 'wellness', 'nutrition', 'health'],
    agenticFlowWeights: {
      informationGathering: 0.20,
      directBooking: 0.25,
      faqSupport: 0.20,
      taskManagement: 0.30,
      personalization: 0.05,
    },
    requiredInformation: {
      programs: { weight: 25, description: 'Fitness programs', examples: ['classes', 'personal training', 'programs', 'schedules'] },
      facilities: { weight: 20, description: 'Facility information', examples: ['equipment', 'amenities', 'hours', 'location'] },
      membership: { weight: 25, description: 'Membership options', examples: ['membership types', 'pricing', 'benefits', 'sign-up process'] },
      staff: { weight: 20, description: 'Staff and trainers', examples: ['trainers', 'credentials', 'specialties', 'availability'] },
      booking: { weight: 10, description: 'Class booking', examples: ['class booking', 'scheduling', 'waitlists'] },
    },
  },
  pet_services: {
    type: 'pet_services',
    displayName: 'Pet Services',
    keywords: ['pet', 'dog', 'cat', 'veterinary', 'grooming', 'boarding', 'training', 'animal'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.25,
      faqSupport: 0.20,
      taskManagement: 0.25,
      personalization: 0.05,
    },
    requiredInformation: {
      services: { weight: 25, description: 'Pet services offered', examples: ['veterinary care', 'grooming', 'boarding', 'training'] },
      staff: { weight: 20, description: 'Staff qualifications', examples: ['veterinarians', 'groomers', 'trainers', 'credentials'] },
      booking: { weight: 25, description: 'Service booking', examples: ['appointments', 'availability', 'emergency services', 'boarding reservations'] },
      policies: { weight: 15, description: 'Pet policies', examples: ['vaccination requirements', 'pet restrictions', 'cancellation policy'] },
      contact: { weight: 15, description: 'Contact information', examples: ['phone', 'address', 'emergency contact', 'hours'] },
    },
  },
  automotive: {
    type: 'automotive',
    displayName: 'Automotive',
    keywords: ['automotive', 'car repair', 'auto repair', 'dealership', 'mechanic', 'garage', 'vehicle service', 'auto service'],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.25,
      faqSupport: 0.20,
      taskManagement: 0.25,
      personalization: 0.05,
    },
    requiredInformation: {
      services: { weight: 25, description: 'Automotive services', examples: ['repair services', 'maintenance', 'diagnostics', 'parts'] },
      booking: { weight: 25, description: 'Service booking', examples: ['appointment scheduling', 'service requests', 'availability'] },
      credentials: { weight: 20, description: 'Service credentials', examples: ['certifications', 'warranties', 'guarantees', 'reviews'] },
      location: { weight: 15, description: 'Location and contact', examples: ['address', 'phone', 'hours', 'directions'] },
      vehicles: { weight: 15, description: 'Vehicle information', examples: ['makes serviced', 'specialties', 'parts availability'] },
    },
  },
  education: {
    type: 'education',
    displayName: 'Education',
    keywords: ['school', 'education', 'learning', 'training', 'course', 'class', 'tutoring', 'academic'],
    agenticFlowWeights: {
      informationGathering: 0.30,
      directBooking: 0.20,
      faqSupport: 0.25,
      taskManagement: 0.20,
      personalization: 0.05,
    },
    requiredInformation: {
      programs: { weight: 30, description: 'Educational programs', examples: ['courses', 'programs', 'curriculum', 'schedules'] },
      enrollment: { weight: 25, description: 'Enrollment process', examples: ['admissions', 'requirements', 'application process', 'deadlines'] },
      staff: { weight: 20, description: 'Faculty and staff', examples: ['teachers', 'instructors', 'credentials', 'experience'] },
      support: { weight: 15, description: 'Student support', examples: ['academic support', 'financial aid', 'resources', 'contact'] },
      facilities: { weight: 10, description: 'Facilities and resources', examples: ['campus', 'libraries', 'labs', 'technology'] },
    },
  },
  financial_services: {
    type: 'financial_services',
    displayName: 'Financial Services',
    keywords: ['bank', 'financial', 'investment', 'insurance', 'loan', 'credit', 'mortgage', 'financial advisor'],
    agenticFlowWeights: {
      informationGathering: 0.30,
      directBooking: 0.15,
      faqSupport: 0.30,
      taskManagement: 0.20,
      personalization: 0.05,
    },
    requiredInformation: {
      services: { weight: 30, description: 'Financial services', examples: ['banking', 'investment', 'insurance', 'loans'] },
      products: { weight: 25, description: 'Financial products', examples: ['account types', 'rates', 'terms', 'benefits'] },
      support: { weight: 25, description: 'Customer support', examples: ['customer service', 'financial advisors', 'support hours'] },
      security: { weight: 20, description: 'Security and compliance', examples: ['security measures', 'compliance', 'privacy policy'] },
    },
  },
  technology_software: {
    type: 'technology_software',
    displayName: 'Technology & Software',
    keywords: ['software', 'technology', 'api', 'documentation', 'developer', 'programming', 'code', 'sdk', 'library', 'framework', 'intel', 'github', 'open source', 'technical', 'engineering', 'development', 'vector search', 'similarity search', 'performance library', 'python api', 'javascript', 'typescript', 'java', 'c++', 'rust'],
    agenticFlowWeights: {
      informationGathering: 0.40,
      directBooking: 0.05,
      faqSupport: 0.35,
      taskManagement: 0.15,
      personalization: 0.05,
    },
    requiredInformation: {
      documentation: { weight: 35, description: 'Technical documentation', examples: ['API docs', 'getting started', 'tutorials', 'examples', 'reference'] },
      installation: { weight: 25, description: 'Installation and setup', examples: ['installation guide', 'requirements', 'dependencies', 'configuration'] },
      examples: { weight: 20, description: 'Code examples', examples: ['sample code', 'tutorials', 'use cases', 'integration examples'] },
      support: { weight: 20, description: 'Developer support', examples: ['community', 'issues', 'contributing', 'contact'] },
    },
  },
  unknown: {
    type: 'unknown',
    displayName: 'Unknown',
    keywords: [],
    agenticFlowWeights: {
      informationGathering: 0.25,
      directBooking: 0.25,
      faqSupport: 0.20,
      taskManagement: 0.20,
      personalization: 0.10,
    },
    requiredInformation: {
      contact: { weight: 30, description: 'Contact information', examples: ['phone', 'email', 'address', 'hours'] },
      services: { weight: 25, description: 'Services or products', examples: ['what they offer', 'pricing', 'availability'] },
      about: { weight: 25, description: 'About the business', examples: ['company info', 'mission', 'team', 'experience'] },
      support: { weight: 20, description: 'Customer support', examples: ['FAQ', 'support contact', 'policies'] },
    },
  },
};

// Cache for compiled regex patterns to improve performance
const regexCache = new Map<string, RegExp>();

/**
 * Get or create a cached word boundary regex for a keyword
 */
function getWordBoundaryRegex(keyword: string): RegExp {
  const cacheKey = keyword.toLowerCase();
  
  if (!regexCache.has(cacheKey)) {
    // Escape special regex characters and create word boundary pattern
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    regexCache.set(cacheKey, regex);
  }
  
  return regexCache.get(cacheKey)!;
}

/**
 * Detect business type based on content analysis
 */
export function detectBusinessType($: any, html: string, url: string): BusinessType {
  const text = $('body').text().toLowerCase();
  const title = $('title').text().toLowerCase();
  const domain = new URL(url).hostname.toLowerCase();
  
  let maxScore = 0;
  let detectedType: BusinessType = 'unknown';
  
  for (const [type, config] of Object.entries(BUSINESS_TYPE_CONFIGS)) {
    if (type === 'unknown') continue;
    
    let score = 0;
    for (const keyword of config.keywords) {
      // Use cached word-boundary regex for text and title to reduce false positives
      const wordBoundaryRegex = getWordBoundaryRegex(keyword);
      
      if (wordBoundaryRegex.test(text)) score += 1;
      if (wordBoundaryRegex.test(title)) score += 2;
      
      // Keep domain checks as substring matches (dot-delimited boundaries)
      if (domain.includes(keyword)) score += 3;
    }
    
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as BusinessType;
    }
  }
  
  return detectedType;
}

/**
 * Analyze agentic flows for a specific business type
 */
export function analyzeAgenticFlows($: any, html: string, businessType: BusinessType): AgenticFlowAnalysis {
  const config = BUSINESS_TYPE_CONFIGS[businessType];
  const text = $('body').text().toLowerCase();
  
  // Information Gathering Analysis
  const informationGathering = {
    score: 0,
    details: {
      hasServiceProductInfo: businessType === 'technology_software' 
        ? /api|library|framework|sdk|software|tool|service|solution|documentation|tutorial|example/i.test(text) ||
          $('.api, .library, .framework, .sdk, .documentation, .tutorial, .example, code').length > 0
        : /service|product|menu|catalog|item|offering|solution/i.test(text) || 
          $('.service, .product, .menu, .catalog, .item').length > 0,
      hasPricing: /\$[\d,]+|\d+\.\d{2}|\d+\s*(dollars?|usd|eur|gbp|price|cost|fee)/i.test(text) ||
        $('.price, .cost, .fee, [data-price]').length > 0,
      hasAvailability: businessType === 'technology_software'
        ? /download|install|available|version|release|changelog|update/i.test(text) ||
          $('.download, .install, .version, .release, .changelog').length > 0
        : /available|hours?|open|closed|schedule|time|slot|appointment/i.test(text) ||
          $('.hours, .schedule, .availability, .time').length > 0,
      hasContactInfo: $('a[href^="tel:"], a[href^="mailto:"]').length > 0 ||
        /phone|email|contact|call|reach|support|github|issues|discussion/i.test(text),
      hasLocation: businessType === 'technology_software'
        ? /repository|github|gitlab|bitbucket|source|code|contribute/i.test(text) ||
          $('a[href*="github"], a[href*="gitlab"], a[href*="bitbucket"], .repository, .source').length > 0
        : /address|location|map|directions|street|city|state|zip/i.test(text) ||
          $('.address, .location, .map, [data-location]').length > 0,
      hasReviews: businessType === 'technology_software'
        ? /stars?|forks?|watchers?|contributors?|community|feedback|testimonial/i.test(text) ||
          $('.stars, .forks, .watchers, .contributors, .community').length > 0
        : /review|rating|stars?|testimonial|feedback/i.test(text) ||
          $('.review, .rating, .stars, .testimonial').length > 0,
      hasPolicies: /policy|terms|conditions|refund|cancellation|privacy|license|mit|apache|gpl/i.test(text) ||
        $('a[href*="policy"], a[href*="terms"], a[href*="privacy"], a[href*="license"]').length > 0,
      hasDifferentiators: businessType === 'technology_software'
        ? /open source|free|performance|optimized|scalable|fast|efficient|benchmark/i.test(text) ||
          $('.open-source, .free, .performance, .optimized, .scalable').length > 0
        : /special|unique|exclusive|certified|licensed|award/i.test(text) ||
          $('.special, .unique, .exclusive, .certified').length > 0,
    }
  };
  
  // Calculate information gathering score
  const igDetails = informationGathering.details;
  informationGathering.score = Math.min(100, Math.round(
    (igDetails.hasServiceProductInfo ? 20 : 0) +
    (igDetails.hasPricing ? 15 : 0) +
    (igDetails.hasAvailability ? 15 : 0) +
    (igDetails.hasContactInfo ? 10 : 0) +
    (igDetails.hasLocation ? 10 : 0) +
    (igDetails.hasReviews ? 10 : 0) +
    (igDetails.hasPolicies ? 10 : 0) +
    (igDetails.hasDifferentiators ? 10 : 0)
  ));
  
  // Direct Booking Analysis
  const directBooking = {
    score: 0,
    details: {
      hasActionableInstructions: /book|order|reserve|schedule|call|contact|buy|purchase/i.test(text) ||
        $('button, .btn, .button, a[href*="book"], a[href*="order"], a[href*="reserve"]').length > 0,
      hasBookingRequirements: /date|time|party|size|preference|requirement/i.test(text) ||
        $('input[type="date"], input[type="time"], select, .form-group').length > 0,
      hasConfirmationProcess: /confirm|confirmation|email|sms|text|notification/i.test(text) ||
        $('.confirmation, .confirm, [data-confirm]').length > 0,
      hasPaymentOptions: /payment|credit|card|paypal|stripe|apple pay|google pay/i.test(text) ||
        $('.payment, .checkout, [data-payment]').length > 0,
      hasModificationPolicies: /modify|change|cancel|reschedule|refund/i.test(text) ||
        $('a[href*="modify"], a[href*="cancel"], a[href*="change"]').length > 0,
      hasErrorHandling: /error|invalid|try again|retry|problem/i.test(text) ||
        $('.error, .alert, .warning').length > 0,
    }
  };
  
  // Calculate direct booking score
  const dbDetails = directBooking.details;
  directBooking.score = Math.min(100, Math.round(
    (dbDetails.hasActionableInstructions ? 20 : 0) +
    (dbDetails.hasBookingRequirements ? 15 : 0) +
    (dbDetails.hasConfirmationProcess ? 10 : 0) +
    (dbDetails.hasPaymentOptions ? 15 : 0) +
    (dbDetails.hasModificationPolicies ? 10 : 0) +
    (dbDetails.hasErrorHandling ? 10 : 0) +
    ($('form').length > 0 ? 20 : 0) // Bonus for having forms
  ));
  
  // FAQ/Support Analysis
  const faqSupport = {
    score: 0,
    details: {
      hasFaq: businessType === 'technology_software'
        ? /faq|frequently asked|questions|help|support|troubleshooting|known issues|issues/i.test(text) ||
          $('.faq, .questions, .help, [data-faq], .troubleshooting, .issues').length > 0
        : /faq|frequently asked|questions|help|support/i.test(text) ||
          $('.faq, .questions, .help, [data-faq]').length > 0,
      hasPolicyDocumentation: businessType === 'technology_software'
        ? /policy|terms|conditions|license|mit|apache|gpl|open source|copyright/i.test(text) ||
          $('a[href*="policy"], a[href*="terms"], a[href*="license"], a[href*="copyright"]').length > 0
        : /policy|terms|conditions|refund|return|cancellation/i.test(text) ||
          $('a[href*="policy"], a[href*="terms"], a[href*="conditions"]').length > 0,
      hasUserGuides: /guide|tutorial|how to|instructions|manual|documentation|getting started|quick start|examples/i.test(text) ||
        $('.guide, .tutorial, .instructions, .manual, .documentation, .getting-started, .examples').length > 0,
      hasEligibilityCriteria: businessType === 'technology_software'
        ? /requirements|prerequisites|dependencies|system requirements|compatibility/i.test(text) ||
          $('.requirements, .prerequisites, .dependencies, .compatibility').length > 0
        : /eligible|qualify|requirement|criteria|age|location/i.test(text) ||
          $('.eligibility, .requirements, .criteria').length > 0,
      hasSupportContact: businessType === 'technology_software'
        ? $('a[href^="tel:"], a[href^="mailto:"], a[href*="github"], a[href*="issues"], a[href*="discussions"]').length > 0 ||
          /support|help|contact|assistance|github|issues|discussions/i.test(text)
        : $('a[href^="tel:"], a[href^="mailto:"]').length > 0 ||
          /support|help|contact|assistance/i.test(text),
      hasSearchFunctionality: $('input[type="search"], .search, #search').length > 0 ||
        /search|find|look for/i.test(text),
    }
  };
  
  // Calculate FAQ support score
  const fsDetails = faqSupport.details;
  faqSupport.score = Math.min(100, Math.round(
    (fsDetails.hasFaq ? 25 : 0) +
    (fsDetails.hasPolicyDocumentation ? 20 : 0) +
    (fsDetails.hasUserGuides ? 15 : 0) +
    (fsDetails.hasEligibilityCriteria ? 10 : 0) +
    (fsDetails.hasSupportContact ? 15 : 0) +
    (fsDetails.hasSearchFunctionality ? 10 : 0) +
    ($('nav, .navigation, .menu, .toc, .table-of-contents').length > 0 ? 5 : 0) // Content organization
  ));
  
  // Task Management Analysis
  const taskManagement = {
    score: 0,
    details: {
      hasScheduleVisibility: /schedule|calendar|hours?|time|appointment|event/i.test(text) ||
        $('.schedule, .calendar, .hours, .time').length > 0,
      hasReservationManagement: /reservation|booking|appointment|reserve|book/i.test(text) ||
        $('.reservation, .booking, .appointment').length > 0,
      hasTaskTracking: /task|checklist|progress|status|complete/i.test(text) ||
        $('.task, .checklist, .progress, .status').length > 0,
      hasReschedulingProcess: /reschedule|modify|change|update|edit/i.test(text) ||
        $('a[href*="reschedule"], a[href*="modify"], a[href*="change"]').length > 0,
      hasMembershipDetails: /membership|subscription|account|profile|member/i.test(text) ||
        $('.membership, .subscription, .account, .profile').length > 0,
      hasNotificationSystems: /notification|alert|reminder|email|sms|text/i.test(text) ||
        $('.notification, .alert, .reminder').length > 0,
    }
  };
  
  // Calculate task management score
  const tmDetails = taskManagement.details;
  taskManagement.score = Math.min(100, Math.round(
    (tmDetails.hasScheduleVisibility ? 25 : 0) +
    (tmDetails.hasReservationManagement ? 20 : 0) +
    (tmDetails.hasTaskTracking ? 15 : 0) +
    (tmDetails.hasReschedulingProcess ? 15 : 0) +
    (tmDetails.hasMembershipDetails ? 15 : 0) +
    (tmDetails.hasNotificationSystems ? 10 : 0)
  ));
  
  // Personalization Analysis
  const personalization = {
    score: 0,
    details: {
      hasPersonalizationData: /personalize|customize|preferences|profile|account/i.test(text) ||
        $('.personalize, .customize, .preferences, .profile').length > 0,
      hasRecommendationLogic: /recommend|suggest|recommended|based on|for you/i.test(text) ||
        $('.recommend, .suggest, .recommended').length > 0,
      hasContextAwareness: /location|time|weather|nearby|local|current/i.test(text) ||
        $('.location-based, .time-based, .contextual').length > 0,
      hasUserProfiling: /profile|account|user|member|customer/i.test(text) ||
        $('.profile, .account, .user, .member').length > 0,
      hasDynamicContent: /dynamic|real-time|live|updated|current/i.test(text) ||
        $('[data-dynamic], .dynamic, .real-time').length > 0,
    }
  };
  
  // Calculate personalization score
  const pDetails = personalization.details;
  personalization.score = Math.min(100, Math.round(
    (pDetails.hasPersonalizationData ? 30 : 0) +
    (pDetails.hasRecommendationLogic ? 25 : 0) +
    (pDetails.hasContextAwareness ? 20 : 0) +
    (pDetails.hasUserProfiling ? 15 : 0) +
    (pDetails.hasDynamicContent ? 10 : 0)
  ));
  
  return {
    informationGathering,
    directBooking,
    faqSupport,
    taskManagement,
    personalization,
  };
}

/**
 * Analyze AI-relevant checks (removed irrelevant ones)
 */
export function analyzeAIRelevantChecks($: any, html: string): AIAgentReadinessResult['aiRelevantChecks'] {
  const text = $('body').text().toLowerCase();
  
  // Content accessibility score - how easy it is for AI to extract information
  let contentAccessibility = 0;
  if ($('h1').length > 0) contentAccessibility += 20; // Clear page structure
  if ($('nav').length > 0) contentAccessibility += 20; // Navigation structure
  if (text.length > 500) contentAccessibility += 20; // Sufficient content
  if ($('a[href^="tel:"], a[href^="mailto:"]').length > 0) contentAccessibility += 20; // Contact info easily accessible
  if ($('.price, .cost, [data-price]').length > 0) contentAccessibility += 20; // Pricing clearly marked
  
  return {
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    hasContactInfo: $('a[href^="tel:"], a[href^="mailto:"]').length > 0 || /phone|email|contact/i.test(text),
    hasPageTitle: $('title').text().trim().length > 0,
    hasMetaDescription: (() => {
      const desc = $('meta[name="description"]').attr('content')
      return !!desc && desc.trim().length > 0
    })(),
    hasSitemap: false, // Will be checked separately
    hasRobotsTxt: false, // Will be checked separately
    contentAccessibility,
  };
}

/**
 * Generate findings and recommendations for AI agent readiness
 */
export function generateAIReadinessInsights(
  businessType: BusinessType,
  agenticFlows: AgenticFlowAnalysis,
  aiChecks: AIAgentReadinessResult['aiRelevantChecks']
): { findings: string[]; recommendations: string[] } {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const config = BUSINESS_TYPE_CONFIGS[businessType];
  
  // Business type specific findings
  if (businessType === 'unknown') {
    findings.push('Business type could not be determined - consider adding clear business description');
    recommendations.push('Add clear business description and keywords to help AI agents understand your business type');
  }
  
  // AI-relevant check findings
  if (!aiChecks.hasStructuredData) {
    findings.push('No structured data (JSON-LD) found - AI agents will have difficulty understanding content structure');
    recommendations.push('Add JSON-LD structured data to help AI agents understand your content and services');
  }
  
  if (!aiChecks.hasContactInfo) {
    findings.push('No easily accessible contact information found');
    recommendations.push('Add clear contact information (phone, email) in easily accessible format');
  }
  
  if (!aiChecks.hasPageTitle) {
    findings.push('No page title found - critical for AI agent identification');
    recommendations.push('Add descriptive page title that clearly identifies your business');
  }
  
  if (aiChecks.contentAccessibility < 60) {
    findings.push('Content accessibility is low - AI agents may struggle to extract key information');
    recommendations.push('Improve content structure with clear headings, navigation, and well-marked pricing/contact info');
  }
  
  // Agentic flow findings
  if (agenticFlows.informationGathering.score < 50) {
    findings.push(`${config.displayName} information gathering score is low (${agenticFlows.informationGathering.score}/100)`);
    recommendations.push(`Improve information availability: add service descriptions, pricing, availability, and contact details`);
  }
  
  if (agenticFlows.directBooking.score < 50) {
    findings.push(`Direct booking capabilities are limited (${agenticFlows.directBooking.score}/100)`);
    recommendations.push(`Add clear booking instructions, forms, and booking requirements for ${config.displayName.toLowerCase()} services`);
  }
  
  if (agenticFlows.faqSupport.score < 50) {
    findings.push(`FAQ and support information is limited (${agenticFlows.faqSupport.score}/100)`);
    recommendations.push(`Add comprehensive FAQ section and support documentation`);
  }

  if (agenticFlows.taskManagement.score < 50) {
    findings.push(`Task management capabilities are limited (${agenticFlows.taskManagement.score}/100)`);
    recommendations.push(`Expose schedule visibility, reservation management, and notification workflows`);
  }

  if (agenticFlows.personalization.score < 50) {
    findings.push(`Personalization features are minimal (${agenticFlows.personalization.score}/100)`);
    recommendations.push(`Add profile/preferences capture and basic recommendation logic where appropriate`);
  }
  
  return { findings, recommendations };
}