export const opportunities = [
  {
    id: 1,
    name: 'XPAIRK Partnership',
    company: 'XPAIRK',
    stage: 'In Progress',
    priority: 'High',
    nextStep: 'Send proposal follow-up',
  },
  {
    id: 2,
    name: 'Frontend Developer Role',
    company: 'Studio North',
    stage: 'Awaiting Reply',
    priority: 'Medium',
    nextStep: 'Check in with recruiter',
  },
  {
    id: 3,
    name: 'Podcast Guest Opportunity',
    company: 'Women in Product Media',
    stage: 'New',
    priority: 'Low',
    nextStep: 'Review invite and respond',
  },
];

export const contentItems = [
  {
    id: 1,
    title: 'Why Women Belong in Tech Leadership',
    platform: 'LinkedIn',
    contentType: 'Article',
    status: 'Drafting',
    purpose: 'Thought leadership — reinforce the CodeHerWay point of view',
    scheduledFor: '',
    notes: 'Repurpose into a 5-part LinkedIn carousel and a newsletter section.',
  },
  {
    id: 2,
    title: 'CodeHerWay Founder Update — May',
    platform: 'Newsletter',
    contentType: 'Newsletter',
    status: 'Editing',
    purpose: 'Community trust — monthly progress and what is next',
    scheduledFor: '2026-05-16',
    notes: 'Pull highlights from the Weekly Brief wins. Tease the CEO OS demo.',
  },
  {
    id: 3,
    title: 'Building CEO OS in Public — Week 3',
    platform: 'LinkedIn',
    contentType: 'Post',
    status: 'Scheduled',
    purpose: 'Product awareness — show the build, invite feedback',
    scheduledFor: '2026-05-14',
    notes: 'Cross-post a shorter version to X. Link to the live walkthrough video.',
  },
  {
    id: 4,
    title: 'How a Founder Operating System Replaced My 6 Spreadsheets',
    platform: 'Blog',
    contentType: 'Article',
    status: 'Idea',
    purpose: 'Top-of-funnel SEO — capture the "founder operating system" search intent',
    scheduledFor: '',
    notes: 'Could become a conference talk. Pair with the dashboard screenshot.',
  },
  {
    id: 5,
    title: 'Lessons From Shipping the Weekly Brief Ritual',
    platform: 'LinkedIn',
    contentType: 'Post',
    status: 'Published',
    purpose: 'Build-in-public credibility — document the decision and the trade-offs',
    scheduledFor: '2026-05-05',
    notes: 'Performed well — expand into a longer Substack essay.',
  },
];

export const weeklyPriorities = [
  {
    id: 1,
    title: 'Send the XPAIRK partnership proposal and book the follow-up call',
    owner: '',
    status: 'In Progress',
  },
  {
    id: 2,
    title: "Finish this week's founder narrative draft and schedule it",
    owner: '',
    status: 'Planned',
  },
  {
    id: 3,
    title: 'Close out the Studio North recruiter conversation',
    owner: '',
    status: 'Blocked',
  },
];

export const weeklyWins = [
  {
    id: 1,
    text: 'Closed the first paid pilot — revenue is real now.',
    category: 'Revenue',
  },
  {
    id: 2,
    text: 'Shipped the onboarding flow the team has been asking for.',
    category: 'Product',
  },
  {
    id: 3,
    text: 'Said no to a distracting partnership without burning the bridge.',
    category: 'Personal',
  },
];

export const weeklyBlockers = [
  {
    id: 1,
    text: 'Partnership proposal is stuck — no one owns the follow-up.',
    severity: 'owner',
  },
  {
    id: 2,
    text: 'Strong content ideas, but no protected window to write.',
    severity: 'time',
  },
];

export const dashboardDemoData = {
  recentActivity: [
    {
      id: 'demo-activity-priority',
      title: 'Priority in motion: Align weekly founder operating rhythm',
      time: 'Today',
      type: 'Planning',
    },
    {
      id: 'demo-activity-opportunity',
      title: 'Opportunity advanced: XPAIRK Partnership (In Progress)',
      time: 'Priority: High',
      type: 'Opportunity',
    },
    {
      id: 'demo-activity-content',
      title: 'Content queued: CEO OS Build in Public Post (Scheduled)',
      time: 'LinkedIn',
      type: 'Content',
    },
  ],
  executiveSnapshotFallback: {
    strategicFocus: 'Set this week\'s primary priority',
    topRisk: 'No critical risks logged',
    momentum: 'Needs attention',
  },
  focusScore: {
    demoSuffix: 'Local demo',
  },
  demoNote: 'Data source: Local only. Sample records stay on this device.',
};

