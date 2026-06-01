export type Role = "super_admin" | "editor" | "photographer";
export type RegistrationStatus = "pending" | "approved" | "rejected";

/** Full public registration intake (stored on player row as JSON). */
export type RegistrationProfile = {
  nationality: string;
  position: string;
  preferredFoot: string;
  previousClub: string;
  parentRelationship: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalInfo: string;
  howHeard: string;
};

export type PaymentStatus = "paid" | "not_paid" | "pending" | "overdue" | "expiring_soon";
/** Active = playing; withdrawn = left club, history retained, hidden from default lists. */
export type PlayerStatus = "active" | "withdrawn";
export type SessionKind = "training" | "match";

/** Derived for UI from subscriptionValidUntil + payments. */
export type SubscriptionUiStatus = "active" | "expiring_soon" | "expired" | "ended";

export type Player = {
  id: string;
  playerName: string;
  dateOfBirth: string;
  ageGroup: string;
  heightCm: number;
  weightKg: number;
  profilePhotoUrl?: string;
  status: PlayerStatus;
  registrationStatus: RegistrationStatus;
  parentId: string;
  /** Optional admin notes (development focus areas). */
  developmentNotes?: string;
  /** End of current subscription / fee period (ISO date). */
  subscriptionValidUntil?: string;
  /** Created timestamp in persistent DB backends. */
  createdAt?: string;
  withdrawnAt?: string | null;
  /** Structured answers from the public registration form (admin view/edit). */
  registrationProfile?: RegistrationProfile;
};

export type Parent = {
  id: string;
  parentName: string;
  phoneNumber: string;
  email: string;
  address: string;
};

export type Payment = {
  id: string;
  playerId: string;
  amount: number;
  currency: string;
  paymentFor: string;
  dueDate: string;
  paidAt?: string;
  status: PaymentStatus;
  paymentMethod?: "cash" | "mobile_money" | "bank_transfer" | "card" | "other";
  paymentNotes?: string;
  mobileMoneyRef?: string;
  proofUrl?: string;
  invoiceSentAt?: string;
  verifiedBy?: string;
};

export type AdminInvoiceLog = {
  id: string;
  paymentId: string;
  playerId: string;
  parentEmail: string;
  parentName: string;
  playerName: string;
  ageGroup: string;
  invoiceNumber: string;
  periodLabel: string;
  amount: number;
  currency: string;
  dueDate: string;
  generatedAt: string;
  generatedBy: string;
  sentAt?: string;
  sentBy?: string;
  pdfUrl: string;
};

/** Optional fields applied in the same write as marking a payment paid (avoids a second UPDATE clobbering state). */
export type VerifyPaymentExtras = Partial<Pick<Payment, "paymentMethod" | "paymentNotes" | "mobileMoneyRef">>;

export type PerformanceEntry = {
  id: string;
  playerId: string;
  date: string;
  notes: string;
  focusArea?: string;
};

export type AdminMessage = {
  id: string;
  createdAt: string;
  /** individual = one parent; group = whole age band */
  channel: "individual" | "group";
  playerId?: string;
  ageGroup?: string;
  subject: string;
  body: string;
  sentBy: string;
};

export type CmsHighlightItem = { id: string; title: string; body: string };
export type CmsProgramGroup = { id: string; name: string; description: string; image?: string };
/** Ordered steps for the animated development pathway (e.g. U9 → U18). */
export type CmsPathwayLineStep = { id: string; name: string; description: string };
export type CmsSocialLink = { id: string; platform: string; url: string };
export type CmsTeamMember = {
  id: string;
  name: string;
  role: string;
  description: string;
  image: string;
  qualifications?: string;
  socialLinks?: CmsSocialLink[];
  /** URL slug for SEO (optional). */
  slug?: string;
  status?: "draft" | "published";
  deletedAt?: string | null;
};
/**
 * `publishedAt` ISO 8601 — drives order on /news and home preview (newest first).
 * Optional on disk for older data; `normalizeNewsPosts` fills it from `date` when missing.
 * `date` is free-form display (e.g. “Apr 2026”).
 */
export type CmsNewsPost = {
  id: string;
  title: string;
  content: string;
  image: string;
  date: string;
  publishedAt?: string;
  /** Optional byline on single-article view */
  author?: string;
  category?: string;
  slug?: string;
  /** `draft` hides the post from the public site; `published` makes it live. Defaults to `published` when missing. */
  status?: "draft" | "published";
  deletedAt?: string | null;
};
/** Academy events (open days, camps, fixtures) — separate from weekly timetable sessions. */
export type CmsEventItem = {
  id: string;
  title: string;
  summary: string;
  /** ISO datetime string */
  startsAt: string;
  endsAt?: string;
  location?: string;
  image?: string;
  registrationLink?: string;
  slug?: string;
  /** `draft` hides the event from the public site; `published` makes it live. Defaults to `published` when missing. */
  status?: "draft" | "published";
  deletedAt?: string | null;
};
export type CmsGalleryItem = { id: string; src: string; caption: string };

/** Single image inside a gallery album (no captions on public album view). */
export type CmsGalleryAlbumImage = { id: string; src: string; kind?: "image" | "video" };

/** Album: cover + ordered images for /gallery and /gallery/[albumId]. */
export type CmsGalleryAlbum = {
  id: string;
  title: string;
  /** Thumbnail on the gallery index */
  coverSrc: string;
  images: CmsGalleryAlbumImage[];
};

/** Single training pitch on /locations — name, address, coordinates, optional legacy embed. */
export type CmsPitchLocation = {
  id: string;
  name: string;
  /** Deprecated legacy field; ignored by admin/public locations UI. */
  image?: string;
  /** Written address / location (primary display copy) */
  address: string;
  /** Legacy field — normalized into `address` when missing */
  line?: string;
  /** WGS84 — used for map pins and fly-to */
  lat: number;
  lng: number;
  /** Optional legacy Google Maps embed (not used on new interactive page) */
  mapEmbedUrl?: string;
};
export type CmsAboutTile = { id: string; title: string; body: string };
export type CmsAboutGalleryItem = { id: string; src: string; caption: string };
export type CmsHomeCounter = { id: string; end: number; suffix: string; title: string; numberVariant?: "default" | "accent" };
export type CmsFaqItem = { id: string; title: string; content: string };
export type CmsHomeTestimonial = { eyebrow: string; quote: string; name: string; role: string; imageSrc: string; imageAlt: string };
export type CmsTestimonial = {
  id: string;
  type: "parent" | "player" | "partner";
  quote: string;
  name: string;
  role: string;
  imageSrc?: string;
  status?: "draft" | "published";
  deletedAt?: string | null;
};
export type CmsSponsor = {
  id: string;
  name: string;
  description: string;
  logoSrc: string;
  websiteUrl: string;
  status?: "draft" | "published";
  deletedAt?: string | null;
};
export type CmsAnnouncement = {
  id: string;
  title: string;
  body: string;
  /** ISO datetime — optional expiry */
  expiresAt?: string;
  status?: "draft" | "published";
  deletedAt?: string | null;
};
export type CmsContactOffice = { id: string; label: string; address: string };
export type CmsContactInfo = {
  phones: { id: string; label: string; number: string }[];
  emails: { id: string; label: string; address: string }[];
  offices: CmsContactOffice[];
  socialLinks: CmsSocialLink[];
};
export type CmsFooterLink = { id: string; label: string; href: string };
export type CmsFooterContent = {
  brandTitle: string;
  brandSubtitle: string;
  logoSrc: string;
  tagline: string;
  quickLinks: CmsFooterLink[];
  copyrightText: string;
  motto: string;
};
export type CmsPageSeo = {
  slug: string;
  title: string;
  metaDescription: string;
  ogImage?: string;
  keywords?: string;
  heroImage?: string;
  status?: "draft" | "published";
};
export type CmsHomeHeroImages = { logo: string };
export type CmsHomeSectionImages = { pathway: string; training: string; iconLogo: string };

export type SiteContent = {
  academyInfo: string;
  contactBlurb: string;
  /** Home hero (Kickstar) */
  homeWelcomePill: string;
  homeHeroHeading: string;
  /** Optional hero background on home (path under public/) */
  homeHeroImage?: string;
  homeHeroImages: CmsHomeHeroImages;
  homeSectionImages: CmsHomeSectionImages;
  /** Home — feature row below hero (matches “highlights” in CMS) */
  homeHighlightItems: CmsHighlightItem[];
  homeCounters: CmsHomeCounter[];
  homeCoachTitle: string;
  homeCoachBody: string;
  homeEliteTitle: string;
  homeEliteBody: string;
  homeMatchTitle: string;
  homeMatchDescription: string;
  homeTimetableTitle: string;
  homeTimetableDescription: string;
  homeDevelopmentLabel: string;
  homeDevelopmentPercent: number;
  homeParentSatisfactionLabel: string;
  homeParentSatisfactionPercent: number;
  homeTestimonial: CmsHomeTestimonial;
  homeFaqItems: CmsFaqItem[];
  homePathTitle: string;
  homePathLead: string;
  homePathTeams: string[];
  homeTrainingTitle: string;
  homeTrainingLead: string;
  homeJoinTitle: string;
  homeJoinLead: string;
  homeJoinButtonLabel: string;
  /** Schedule / fixtures page */
  schedulePagePill: string;
  scheduleHeroImage: string;
  schedulePageTitle: string;
  schedulePageLead: string;
  scheduleTimelineTitle: string;
  scheduleTimelineLead: string;
  scheduleLocationTitle: string;
  scheduleLocationLead: string;
  scheduleLocationImage: string;
  scheduleParentBlurb: string;
  /** About page */
  aboutPagePill: string;
  aboutPageTitle: string;
  aboutHeroImage: string;
  aboutPageLead: string;
  aboutVisionTitle: string;
  aboutMission: string;
  aboutVision: string;
  aboutHistory: string;
  aboutManagementMessage: string;
  aboutGalleryItems: CmsAboutGalleryItem[];
  aboutValuesTitle: string;
  aboutPageImage: string;
  aboutSplitTitle: string;
  aboutSplitLead: string;
  aboutTiles: CmsAboutTile[];
  aboutCtaTitle: string;
  aboutCtaLead: string;
  /** Programs (/programs, /teams) */
  programsPagePill: string;
  programsHeroImage: string;
  programsPageTitle: string;
  programsPageLead: string;
  programsSpotlightTitle: string;
  programsSpotlightLead: string;
  programsSpotlightItems: CmsAboutGalleryItem[];
  programsPathwayTitle: string;
  programsPathwayBlurb: string;
  /** Animated line pathway (U9 → U18, etc.) */
  programsPathwayLineTitle: string;
  programsPathwayLineLead: string;
  /** Small caps label under the animated vertical hint (same style as hero “Explore squads”). */
  programsPathwayLineScrollLabel: string;
  programsPathwayLineItems: CmsPathwayLineStep[];
  programGroups: CmsProgramGroup[];
  programsSideImage: string;
  programsSplitTitle: string;
  programsSplitLead: string;
  programsCtaTitle: string;
  programsCtaLead: string;
  /** Our team */
  ourTeamPageTitle: string;
  ourTeamPageLead: string;
  teamMembers: CmsTeamMember[];
  /** News */
  newsPageTitle: string;
  newsPageLead: string;
  newsPosts: CmsNewsPost[];
  /** Events (/events) */
  eventsPageTitle: string;
  eventsPageLead: string;
  events: CmsEventItem[];
  /** Gallery */
  galleryPageTitle: string;
  galleryPageLead: string;
  galleryAlbums: CmsGalleryAlbum[];
  /** Location (/locations) */
  locationPageTitle: string;
  locationPageLead: string;
  /** Pitches — name, area line, map each */
  pitchLocations: CmsPitchLocation[];
  /** Legacy single-map fields; kept for migration / older saves */
  locationMapEmbedUrl: string;
  locationAddressLine: string;
  /** Contact page hero lead */
  contactPageLead: string;
  contactOfficeHours: string;
  contactHeroImage: string;
  eventsHeroImage: string;
  galleryHeroImage: string;
  newsHeroImage: string;
  ourTeamHeroImage: string;
  contactInfo: CmsContactInfo;
  footerContent: CmsFooterContent;
  testimonials: CmsTestimonial[];
  sponsors: CmsSponsor[];
  announcements: CmsAnnouncement[];
  pageSeo: CmsPageSeo[];
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  message: string;
  enquiryType?: string;
  createdAt: string;
  readAt?: string | null;
  deletedAt?: string | null;
};

export type TimetableSession = {
  id: string;
  /** Display title (e.g. "U9 Training"); shown on the public schedule. */
  title: string;
  /** Primary squad — first entry in `ageGroups` (notifications, legacy filters). */
  ageGroup: string;
  /** One or more squads assigned to this session. */
  ageGroups: string[];
  kind: SessionKind;
  /** ISO datetime — canonical start instant. */
  startsAt: string;
  /** ISO datetime — canonical end instant. */
  endsAt: string;
  locationName: string;
  kitRequirements: string;
  trainerName: string;
  /** Training topics / activities shown on the public schedule popup. */
  activities: string[];
  sessionObjectives: string;
  equipmentNotes: string;
  instructorNotes: string;
  /** True after an admin edit; drives the public “Updated” badge. */
  isUpdated: boolean;
  /** ISO timestamp of last substantive edit; null until first update. */
  updatedAt: string | null;
};
