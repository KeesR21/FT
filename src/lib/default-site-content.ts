import { addDays } from "date-fns";
import { LONG_TRIALS_ARTICLE_HTML } from "@/lib/long-sample-post-body";
import type { SiteContent } from "@/lib/types";

export function buildDefaultSiteContent(): SiteContent {
  return {
  academyInfo:
    "FTPR Lions combines professional coaching with player welfare across age groups U7–U18.",
  contactBlurb: "Reach us at info@ftprlions.com or +250 780 000 000 for enrolment queries.",
  homeWelcomePill: "Welcome to FTPR Lions",
  homeHeroHeading: "THE JOURNEY TO GREATNESS STARTS HERE",
  homeHeroImage: "/gallery/FTPR_49.JPG",
  homeHeroImages: {
    logo: "/logo.jpeg"
  },
  homeSectionImages: {
    pathway: "/academy-3.png",
    training: "/academy-2.png",
    iconLogo: "/logo.jpeg"
  },
  homeHighlightItems: [
    { id: "hl-1", title: "Professional coaching", body: "UEFA-licensed staff across every age group." },
    { id: "hl-2", title: "Transparent progress", body: "Parents see development notes and match exposure." },
    { id: "hl-3", title: "Pathway to competition", body: "Structured steps from foundation skills to elite prep." }
  ],
  homeCounters: [
    { id: "hc-1", end: 10, suffix: "k+", title: "Players Trained", numberVariant: "accent" },
    { id: "hc-2", end: 200, suffix: "+", title: "Tournaments Won", numberVariant: "default" },
    { id: "hc-3", end: 500, suffix: "+", title: "Matches Played", numberVariant: "accent" },
    { id: "hc-4", end: 350, suffix: "+", title: "Contracts Signed", numberVariant: "default" }
  ],
  homeCoachTitle: "Professional Coach",
  homeCoachBody: "Structured coaching pathways, clear feedback, and development plans for every age group.",
  homeEliteTitle: "Elite Training",
  homeEliteBody: "Inspired by Greatness",
  homeMatchTitle: "Match performance",
  homeMatchDescription: "Weekly fixtures and competitive exposure by age group.",
  homeTimetableTitle: "Structured timetable",
  homeTimetableDescription: "Training blocks published online and sent by email reminders.",
  homeDevelopmentLabel: "Player development pathway",
  homeDevelopmentPercent: 85,
  homeParentSatisfactionLabel: "Parent satisfaction (internal)",
  homeParentSatisfactionPercent: 92,
  homeTestimonial: {
    eyebrow: "Parent voice",
    quote:
      "Our coaches are consistent and easy to reach—my son looks forward to every session. Fees and the weekly schedule are clear, so we always know what’s next.",
    name: "Parent, FTPR Lions family",
    role: "U14 squad",
    imageSrc: "/academy-2.png",
    imageAlt: "FTPR Lions parent"
  },
  homeFaqItems: [
    {
      id: "faq-1",
      title: "How do I register my child?",
      content: "Use the Registration page, complete the form, and wait for admin approval. You will receive an email when the status changes."
    },
    {
      id: "faq-2",
      title: "How are fees paid?",
      content: "Fees are tracked in RWF. Mobile money payments can be submitted and verified manually by the academy admin."
    },
    {
      id: "faq-3",
      title: "How do I get schedule reminders?",
      content: "When automated notifications are enabled, reminders are sent by group for training and matches."
    }
  ],
  homePathTitle: "Your Path to Football {{Excellence}}",
  homePathLead: "Age-specific programs from foundation skills to elite preparation.",
  homePathTeams: ["U7", "U9", "U11", "U14A", "U14B", "U16", "U18", "Elite Camp"],
  homeTrainingTitle: "Training & {{Schedule}}",
  homeTrainingLead: "Tuesday and Thursday blocks, Saturday matchdays.",
  homeJoinTitle: "Join FTPR Lions {{Today}}",
  homeJoinLead: "Start registration — our team will review your application.",
  homeJoinButtonLabel: "Start registration",
  schedulePagePill: "WEEKLY OPERATIONS",
  scheduleHeroImage: "/gallery/FTPR_58.JPG",
  schedulePageTitle: "Training & Match Timetable",
  schedulePageLead: "Live weekly operations for every squad, with clear timing and location details.",
  scheduleTimelineTitle: "This week on the pitch",
  scheduleTimelineLead: "Smooth, readable timeline for training blocks and match windows.",
  scheduleLocationTitle: "Pitch location",
  scheduleLocationLead: "Main academy ground and partner surfaces prepared for each group session.",
  scheduleLocationImage: "/gallery/FTPR_49.JPG",
  scheduleParentBlurb:
    "Timetable reminders are sent automatically by group when sessions are added or changed (email when Resend is configured).",
  aboutPagePill: "ABOUT FTPR LIONS",
  aboutPageTitle: "A modern academy for Rwanda’s next generation",
  aboutHeroImage: "/gallery/FTPR_49.JPG",
  aboutPageLead:
    "We combine professional coaching, discipline, and player welfare to develop confident footballers on and off the pitch.",
  aboutVisionTitle: "Our vision",
  aboutGalleryItems: [
    { id: "ag-1", src: "/gallery/FTPR_25.JPG", caption: "Focused training — every session counts" },
    { id: "ag-2", src: "/gallery/FTPR_38.JPG", caption: "Coaching that builds confidence" },
    { id: "ag-3", src: "/gallery/FTPR_55.JPG", caption: "Together on the pitch" }
  ],
  aboutValuesTitle: "What we stand for",
  aboutPageImage: "/academy-3.png",
  aboutSplitTitle: "On the pitch with you",
  aboutSplitLead:
    "From foundation skills to competitive readiness, we keep parents informed and players motivated — every week.",
  aboutTiles: [
    {
      id: "abt-1",
      title: "Coaching philosophy",
      body: "Technical mastery, tactical awareness, and high-intensity game IQ."
    },
    {
      id: "abt-2",
      title: "Safeguarding & welfare",
      body: "A safe environment with clear parent communication and progress tracking."
    }
  ],
  aboutCtaTitle: "Ready to take the next step?",
  aboutCtaLead:
    "We welcome families who want clear communication, structured development, and a supportive pathway for young players.",
  programsPagePill: "PROGRAMS & PATHWAY",
  programsHeroImage: "/gallery/FTPR_18.JPG",
  programsPageTitle: "Teams & age groups",
  programsPageLead:
    "From first touches to competitive squads — clear structure, modern coaching, and a pathway parents can follow.",
  programsSpotlightTitle: "Training that shows on the pitch",
  programsSpotlightLead: "Technical work, small-sided games, and match rhythm — built for every stage of development.",
  programsSpotlightItems: [
    { id: "ps-1", src: "/gallery/FTPR_25.JPG", caption: "Ball mastery & movement" },
    { id: "ps-2", src: "/gallery/FTPR_38.JPG", caption: "Tactical awareness in play" },
    { id: "ps-3", src: "/gallery/FTPR_55.JPG", caption: "Squad energy & discipline" }
  ],
  programsPathwayTitle: "Development pathway",
  programsPathwayBlurb:
    "Each group follows a weekly training cycle aligned with physical and tactical age needs. Coaches set clear objectives and keep families in the loop.",
  programsPathwayLineTitle: "Player progression",
  programsPathwayLineLead: "From first structured sessions to elite-ready football — one continuous pathway.",
  programsPathwayLineScrollLabel: "Follow the pathway",
  programsPathwayLineItems: [
    { id: "pl-1", name: "U9", description: "Introduction to football basics — fun, movement, and ball familiarity." },
    { id: "pl-2", name: "U11", description: "Skill development — passing, receiving, and small-sided confidence." },
    { id: "pl-3", name: "U13", description: "Tactical awareness — shape, transitions, and game pictures." },
    { id: "pl-4", name: "U15", description: "Physical development & competitive tempo — intensity and decision speed." },
    { id: "pl-5", name: "U18", description: "Elite preparation — performance habits, leadership, and progression focus." }
  ],
  programGroups: [
    {
      id: "pg-1",
      name: "U7",
      description: "Foundation movement, fun drills, and ball confidence.",
      image: "/gallery/FTPR_12.JPG"
    },
    {
      id: "pg-2",
      name: "U9",
      description: "Core technical training and small-sided tactical play.",
      image: "/academy-1.png"
    },
    {
      id: "pg-3",
      name: "U11",
      description: "Positioning, passing combinations, and transitions.",
      image: "/gallery/FTPR_3.JPG"
    },
    {
      id: "pg-4",
      name: "U14A",
      description: "Advanced development for high-potential players.",
      image: "/academy-3.png"
    },
    {
      id: "pg-5",
      name: "U14B",
      description: "Competitive pathway with match readiness focus.",
      image: "/gallery/FTPR_49.JPG"
    },
    {
      id: "pg-6",
      name: "U16",
      description: "Game intelligence, physical conditioning, leadership.",
      image: "/academy-2.png"
    },
    {
      id: "pg-7",
      name: "U18",
      description: "Elite performance and progression preparation.",
      image: "/gallery/FTPR_58.JPG"
    }
  ],
  programsSideImage: "/academy-2.png",
  programsSplitTitle: "The right group, the right pace",
  programsSplitLead:
    "We place players where they can grow with confidence — challenging enough to improve, supportive enough to love the game.",
  programsCtaTitle: "Register for trials or ask a question",
  programsCtaLead: "Tell us your child’s age and experience — we’ll guide you to the best entry point.",
  ourTeamPageTitle: "Meet Our Coaching Staff",
  ourTeamPageLead: "Dedicated professionals focused on player growth, discipline, and match performance.",
  teamMembers: [
    {
      id: "tm-1",
      name: "Head Coach",
      role: "Technical Director",
      description: "Leads curriculum and match strategy across age groups.",
      image: "/academy-3.png"
    },
    {
      id: "tm-2",
      name: "Assistant Coach",
      role: "Youth Development",
      description: "Focus on foundation skills and player welfare.",
      image: "/academy-2.png"
    },
    {
      id: "tm-3",
      name: "Fitness Coach",
      role: "Conditioning",
      description: "Speed, agility, and injury-prevention programming.",
      image: "/academy-1.png"
    }
  ],
  newsPageTitle: "Latest Updates",
  newsPageLead:
    "Match reports, academy announcements, and practical notes for families — refreshed regularly as the season unfolds.",
  eventsPageTitle: "Events",
  eventsPageLead: "Open days, camps, and special fixtures.",
  events: [
    {
      id: "ev-1",
      title: "Summer trial day",
      summary: "Open session for new U9–U14 players — register via contact form.",
      startsAt: addDays(new Date(), 14).toISOString(),
      location: "Main Academy Pitch"
    }
  ],
  newsPosts: [
    {
      id: "nw-1",
      title: "New Trial Dates Announced for U11 and U14",
      author: "Academy Communications",
      content: LONG_TRIALS_ARTICLE_HTML,
      date: "Apr 2026",
      image: "/academy-1.png",
      publishedAt: "2026-04-01T12:00:00.000Z"
    },
    {
      id: "nw-2",
      title: "Weekend Camp Focused on Tactical Intelligence",
      author: "Youth Development Staff",
      content: `<p>This month’s residential-style <strong>weekend camp</strong> puts the spotlight on <em>tactical intelligence</em>: when to press, how to shift shape without the ball, and how to read cues from opponents before they become dangerous.</p>
<p>Sessions move from classroom-style video clips — kept short and concrete — into drills that force repeated decisions under time pressure. Coaches freeze play at key moments so players explain what they saw; that reflection is where habits stick.</p>
<h2>What players take away</h2>
<ul>
<li>Clear language for pressing triggers and cover shadows.</li>
<li>Better communication between lines — midfield and defence linked by simple calls.</li>
<li>A personal note from staff on one “next focus” for the following month.</li>
</ul>
<h3>Schedule snapshot</h3>
<p>Saturday leans toward principles and patterns; Sunday connects those patterns to match scenarios with larger goals and small-sided games. Hydration breaks and recovery are scheduled — welfare is never an afterthought.</p>
<p>Parents receive a one-page summary after the camp so conversations at home can reinforce what was coached on the pitch.</p>`,
      date: "Mar 2026",
      image: "/academy-3.png",
      publishedAt: "2026-03-18T12:00:00.000Z"
    },
    {
      id: "nw-3",
      title: "Parent Briefing on Monthly Payment Workflow",
      content: `<p>We are publishing a concise overview of how <strong>monthly fees</strong> are tracked, how mobile-money submissions are verified, and where families can ask questions if something does not look right on their statement.</p>
<p>Fees are quoted in <strong>RWF</strong>. When you submit a payment reference, please allow up to two working days for manual verification — our admin team matches references against bank or mobile-money records before the player’s profile is updated.</p>
<h2>Key dates</h2>
<ul>
<li><strong>Invoice reminder</strong> — sent by email at the start of each billing period.</li>
<li><strong>Grace window</strong> — communicated clearly in the same message; we avoid surprise penalties.</li>
<li><strong>Support</strong> — reach the office during published hours via phone or the contact page.</li>
</ul>
<blockquote><p>“Clarity for parents means fewer distractions for players. If in doubt, ask — we would rather fix a small issue early.”</p></blockquote>
<p>If your child is registered across more than one programme element, you will see separate line items so you can reconcile easily. Thank you for helping us keep administration smooth for every squad.</p>`,
      date: "Mar 2026",
      image: "/academy-2.png",
      publishedAt: "2026-03-02T12:00:00.000Z"
    }
  ],
  galleryPageTitle: "Gallery",
  galleryPageLead: "Real moments from FTPR Lions training and match environments.",
  galleryAlbums: [
    {
      id: "album-training",
      title: "Training & sessions",
      coverSrc: "/gallery/FTPR_49.JPG",
      images: [
        { id: "album-training-1", src: "/gallery/FTPR_49.JPG" },
        { id: "album-training-2", src: "/gallery/FTPR_25.JPG" },
        { id: "album-training-3", src: "/gallery/FTPR_3.JPG" }
      ]
    },
    {
      id: "album-matchday",
      title: "Matchday",
      coverSrc: "/gallery/FTPR_58.JPG",
      images: [
        { id: "album-matchday-1", src: "/gallery/FTPR_38.JPG" },
        { id: "album-matchday-2", src: "/gallery/FTPR_55.JPG" },
        { id: "album-matchday-3", src: "/gallery/FTPR_58.JPG" }
      ]
    },
    {
      id: "album-academy",
      title: "Academy life",
      coverSrc: "/gallery/FTPR_12.JPG",
      images: [
        { id: "album-academy-1", src: "/gallery/FTPR_12.JPG" },
        { id: "album-academy-2", src: "/gallery/FTPR_18.JPG" }
      ]
    }
  ],
  locationPageTitle: "Pitch locations",
  locationPageLead:
    "Choose a pitch to see the address and map. Pins show every site — click the list or a pin to focus.",
  locationMapEmbedUrl: "https://www.google.com/maps?q=Accra%20Sports%20Stadium&output=embed",
  locationAddressLine: "Kigali, Rwanda — training sites across Gasabo & Nyarugenge.",
  pitchLocations: [
    {
      id: "pitch-main",
      name: "Main Academy Pitch",
      address: "Gasabo — primary grass pitch, floodlit evening sessions.",
      lat: -1.9441,
      lng: 30.0619,
      mapEmbedUrl: "https://www.google.com/maps?q=Kigali%20Stadium&output=embed"
    },
    {
      id: "pitch-lion",
      name: "Lion Arena",
      address: "Nyarugenge — synthetic turf, youth matches and camps.",
      lat: -1.9605,
      lng: 30.0842,
      mapEmbedUrl: "https://www.google.com/maps?q=Accra%20Sports%20Stadium&output=embed"
    },
    {
      id: "pitch-east",
      name: "East Sports Complex",
      address: "Regional venue — U15+ fixtures and open days.",
      lat: -1.9288,
      lng: 30.1014,
      mapEmbedUrl: "https://www.google.com/maps?q=Kigali%20Convention%20Centre&output=embed"
    },
    {
      id: "pitch-main-duplicate",
      name: "Main Academy Pitch",
      address: "Duplicate list entry — same name; pin offset on map for preview.",
      lat: -1.9512,
      lng: 30.0524,
      mapEmbedUrl: "https://www.google.com/maps?q=Kigali%20Stadium&output=embed"
    },
    {
      id: "pitch-lion-duplicate",
      name: "Lion Arena",
      address: "Second Lion Arena card — layout testing.",
      lat: -1.972,
      lng: 30.0988,
      mapEmbedUrl: "https://www.google.com/maps?q=Accra%20Sports%20Stadium&output=embed"
    },
    {
      id: "pitch-u12",
      name: "U12 Development Ground",
      address: "Smaller-sided games and skills blocks — weekday afternoons.",
      lat: -1.9356,
      lng: 30.0422,
      mapEmbedUrl: "https://www.google.com/maps?q=Kigali&output=embed"
    },
    {
      id: "pitch-recovery",
      name: "Recovery & warm-up strip",
      address: "Adjacent to main pitch — activation and cool-down sessions.",
      lat: -1.9399,
      lng: 30.0733,
      mapEmbedUrl: "https://www.google.com/maps?q=Gasabo&output=embed"
    }
  ],
  contactPageLead:
    "Send us your enquiry about registration, programs, schedules, or academy operations.",
  contactOfficeHours: "Office Hours: Mon–Fri, 09:00 – 17:00"
};
}
