# Business-Type-Aware AI Agent Readiness Assessment

## Overview

The assessment system has been completely redesigned to focus on **AI agent usability** across different business types, removing irrelevant checks and implementing business-type-specific evaluation criteria.

## Key Changes

### ❌ **Removed Irrelevant Checks**
- **Mobile Optimization** - Doesn't help AI agents parse content
- **Page Load Speed** - Speed doesn't affect AI agent data extraction  
- **Accessibility Score** - Accessibility is for humans, not AI agents
- **SEO Score** - SEO is for search engines, not AI agents
- **Favicon/Manifest/Service Worker** - Visual/PWA features don't help AI agents
- **Image Count** - Image count doesn't help AI agents understand content
- **Heading Structure** - HTML structure is less important than content availability

### ✅ **AI-Relevant Checks Only**
- **Structured Data (JSON-LD)** - Helps AI agents understand content structure
- **Contact Information** - Essential for AI agents to find contact details
- **Page Title** - Helps AI agents understand page purpose
- **Meta Description** - Provides context for AI agents
- **Content Accessibility** - How easy it is for AI to extract information
- **Sitemap/Robots.txt** - AI-relevant for crawling

## Business Types Supported

The system now supports **15 different business types** with specific evaluation criteria:

### 1. **Food Service** (restaurants, cafes, bars)
- **Weighted Flows**: Direct Booking (30%), Information Gathering (25%), Task Management (20%)
- **Required Info**: Menu, Hours, Location, Booking options, Policies

### 2. **Hospitality** (hotels, resorts, accommodations)
- **Weighted Flows**: Direct Booking (35%), Information Gathering (20%), Task Management (20%)
- **Required Info**: Room types, Location, Booking system, Services, Policies

### 3. **Travel** (travel agencies, tour operators)
- **Weighted Flows**: Information Gathering (25%), Direct Booking (30%), FAQ Support (20%)
- **Required Info**: Destinations, Booking system, Travel information, Support, Reviews

### 4. **Healthcare** (doctors, clinics, medical services)
- **Weighted Flows**: Information Gathering (25%), Direct Booking (25%), FAQ Support (25%)
- **Required Info**: Services, Providers, Booking, Location, Insurance

### 5. **Professional Services** (lawyers, accountants, consultants)
- **Weighted Flows**: Information Gathering (30%), FAQ Support (25%), Task Management (20%)
- **Required Info**: Expertise, Contact, Process, Credentials

### 6. **Retail & E-commerce**
- **Weighted Flows**: Information Gathering (25%), Direct Booking (25%), Personalization (15%)
- **Required Info**: Products, Pricing, Purchase process, Support

### 7. **Home Services** (cleaning, plumbing, contractors)
- **Weighted Flows**: Direct Booking (30%), Information Gathering (25%), Task Management (20%)
- **Required Info**: Services, Booking, Credentials, Contact

### 8. **Beauty & Wellness** (salons, spas, fitness)
- **Weighted Flows**: Direct Booking (30%), Task Management (25%), Information Gathering (20%)
- **Required Info**: Services, Staff, Booking, Location

### 9. **Events & Experiences** (venues, event planning)
- **Weighted Flows**: Information Gathering (25%), Direct Booking (25%), Task Management (25%)
- **Required Info**: Events, Venue, Booking, Services

### 10. **Fitness & Wellness** (gyms, personal training)
- **Weighted Flows**: Task Management (30%), Direct Booking (25%), Information Gathering (20%)
- **Required Info**: Programs, Facilities, Membership, Staff, Booking

### 11. **Pet Services** (veterinary, grooming, boarding)
- **Weighted Flows**: Information Gathering (25%), Direct Booking (25%), Task Management (25%)
- **Required Info**: Services, Staff, Booking, Policies, Contact

### 12. **Automotive** (repair, service, dealerships)
- **Weighted Flows**: Information Gathering (25%), Direct Booking (25%), Task Management (25%)
- **Required Info**: Services, Booking, Credentials, Location, Vehicles

### 13. **Education** (schools, training, courses)
- **Weighted Flows**: Information Gathering (30%), FAQ Support (25%), Task Management (20%)
- **Required Info**: Programs, Enrollment, Staff, Support, Facilities

### 14. **Financial Services** (banks, investment, insurance)
- **Weighted Flows**: Information Gathering (30%), FAQ Support (30%), Task Management (20%)
- **Required Info**: Services, Products, Support, Security

### 15. **Unknown** (fallback for undetected types)
- **Weighted Flows**: Balanced across all flows
- **Required Info**: Contact, Services, About, Support

## Agentic Flows Analysis

Each business type is evaluated on **5 core agentic flows**:

### 1. **Information Gathering & Comparison** (25-30% weight)
- Service/Product information availability
- Pricing transparency
- Availability/operating hours
- Contact information accessibility
- Location details
- Reviews and testimonials
- Policies and terms
- Unique differentiators

### 2. **Direct Booking & Reservations** (15-35% weight)
- Clear actionable instructions
- Booking requirements and forms
- Confirmation processes
- Payment options
- Modification/cancellation policies
- Error handling systems

### 3. **FAQ & Knowledge Support** (15-30% weight)
- Frequently asked questions
- Policy documentation
- User guides and tutorials
- Eligibility criteria
- Support contact information
- Search functionality

### 4. **Task & Calendar Management** (20-30% weight)
- Schedule visibility
- Reservation management
- Task tracking capabilities
- Rescheduling processes
- Membership details
- Notification systems

### 5. **Personalization & Recommendations** (5-15% weight)
- Personalization data collection
- Recommendation logic
- Context awareness
- User profiling
- Dynamic content delivery

## Scoring System

### Business Type Detection
- **Confidence Score**: 0-100 based on keyword matches in content, title, and domain
- **Automatic Detection**: Analyzes content to identify business type
- **Fallback**: Uses "Unknown" type with balanced weights if detection fails

### Weighted Overall Score
- Each agentic flow score is weighted based on business type priorities
- **Formula**: `(IG × W1) + (DB × W2) + (FAQ × W3) + (TM × W4) + (P × W5)`
- **Result**: 0-100 score reflecting AI agent readiness for that specific business type

### AI-Relevant Checks Score
- **Content Accessibility**: 0-100 based on how easy it is for AI to extract information
- **Structured Data**: Boolean - presence of JSON-LD markup
- **Contact Info**: Boolean - easily accessible contact details
- **Page Title**: Boolean - descriptive page title
- **Meta Description**: Boolean - helpful meta description
- **Sitemap/Robots**: Boolean - crawling support

## Implementation Details

### New Files Created
- `lib/business-type-analyzer.ts` - Core business type detection and analysis
- `dev/BUSINESS-TYPE-AWARE-ASSESSMENT.md` - This documentation

### Modified Files
- `lib/analyzer.ts` - Updated website analysis to use new system
- `lib/aligned-assessment-engine.ts` - Updated to handle new interface
- `app/api/analyze/route.ts` - Updated API to return business-type-aware data

### API Response Changes
- Added `businessTypeAnalysis` object with:
  - `businessType`: Detected business type
  - `businessTypeConfidence`: Detection confidence (0-100)
  - `overallScore`: Weighted AI readiness score
  - `agenticFlows`: Detailed flow analysis
  - `aiRelevantChecks`: AI-specific checks only
  - `findings`: Business-type-specific findings
  - `recommendations`: Targeted recommendations

## Benefits

### 1. **Relevant Assessment**
- Only evaluates what actually matters for AI agents
- Business-type-specific criteria and weights
- Focused on actionable improvements

### 2. **Scalable System**
- Easy to add new business types
- Configurable weights and requirements
- Extensible agentic flow analysis

### 3. **Better Insights**
- Targeted findings and recommendations
- Business-context-aware scoring
- Clear action items for improvement

### 4. **AI Agent Focus**
- Removed human-focused metrics (accessibility, SEO)
- Added AI-specific checks (structured data, content accessibility)
- Emphasized information availability over presentation

## Usage Examples

### Food Service Analysis
```typescript
{
  businessType: "food_service",
  businessTypeConfidence: 85,
  overallScore: 72,
  agenticFlows: {
    informationGathering: { score: 80, details: {...} },
    directBooking: { score: 65, details: {...} },
    // ... other flows
  },
  findings: [
    "Menu information is comprehensive but missing pricing",
    "No online reservation system found"
  ],
  recommendations: [
    "Add clear pricing information to menu items",
    "Implement online reservation system for better AI agent support"
  ]
}
```

### Healthcare Analysis
```typescript
{
  businessType: "healthcare",
  businessTypeConfidence: 92,
  overallScore: 68,
  agenticFlows: {
    informationGathering: { score: 75, details: {...} },
    directBooking: { score: 60, details: {...} },
    faqSupport: { score: 70, details: {...} }
  },
  findings: [
    "Medical services are well documented",
    "Appointment booking system needs improvement"
  ],
  recommendations: [
    "Add online appointment scheduling",
    "Include insurance information for each service"
  ]
}
```

This new system provides **coherent, relevant, and actionable** assessments that help businesses understand exactly how to improve their AI agent readiness for their specific industry and use case.