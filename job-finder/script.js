const profiles = [
  {
    id: 1,
    name: 'Maya Chen',
    title: 'VP of Engineering',
    company: 'Northstar Labs',
    location: 'Remote',
    function: 'Engineering',
    experience: 'Leadership',
    responseHours: 12,
    match: 96,
    date: 'Active today',
    tags: ['AI product', 'Platform', 'Hiring manager'],
    summary: 'Building the next generation of AI workflows for operations teams and hiring product-minded engineers.',
    description: 'We are scaling our platform team and looking for builders who care deeply about systems, customer experience, and high-leverage product work. The ideal candidate is collaborative, metrics-driven, and comfortable with ambiguity.',
    lookingFor: [
      'Senior engineers with strong product instincts and high ownership.',
      'Builders who can move from idea to shipped customer value quickly.',
      'People who enjoy mentoring teammates and improving team velocity.'
    ],
    profile: [
      'Led product and platform teams across B2B SaaS environments.',
      'Currently hiring for frontend, backend, and ML-oriented engineers.',
      'Strong focus on design quality, product thinking, and customer outcomes.'
    ]
  },
  {
    id: 2,
    name: 'Ava Brooks',
    title: 'Head of Product',
    company: 'Asteria Health',
    location: 'Hybrid',
    function: 'Product',
    experience: 'Senior',
    responseHours: 24,
    match: 91,
    date: 'Posted 2h ago',
    tags: ['UX research', 'Healthtech', 'Growth'],
    summary: 'Hiring product leads who can rethink patient workflows and turn research into high-impact features.',
    description: 'We are improving the patient onboarding experience and need a product leader who can translate user pain points into crisp strategy, measurable outcomes, and high-quality execution with design and engineering partners.',
    lookingFor: [
      'Product thinkers with strong customer empathy and analytical rigor.',
      'Background in healthcare or complex service workflows.',
      'Comfort leading cross-functional prioritization and roadmap trade-offs.'
    ],
    profile: [
      'Building enterprise B2B and patient experience improvements.',
      'Looking for a cross-functional PM with strong discovery skills.',
      'Cares deeply about measurable product outcomes and customer trust.'
    ]
  },
  {
    id: 3,
    name: 'Nolan Price',
    title: 'Director of Growth',
    company: 'Beacon Forge',
    location: 'Remote',
    function: 'Marketing',
    experience: 'Leadership',
    responseHours: 48,
    match: 88,
    date: 'Active this week',
    tags: ['Demand gen', 'Lifecycle', 'AI marketing'],
    summary: 'Hiring marketers and demand leaders who can scale growth loops with AI-assisted experimentation.',
    description: 'Our growth function is expanding to support the launch of an AI-powered workflow platform. We are hiring people who can blend experimentation, lifecycle design, and product marketing into a clear customer narrative.',
    lookingFor: [
      'Talent that can connect acquisition strategy to retention metrics.',
      'Operators with strong experimentation and messaging instincts.',
      'People who can translate technical value into business outcomes.'
    ],
    profile: [
      'Supportive leadership team with strong investment in creative testing.',
      'Hiring across lifecycle, SEO, and product marketing functions.',
      'Interested in strong communicators and cross-functional operators.'
    ]
  },
  {
    id: 4,
    name: 'Elena Vargas',
    title: 'Design Director',
    company: 'Quanta Retail',
    location: 'On-site',
    function: 'Design',
    experience: 'Leadership',
    responseHours: 36,
    match: 86,
    date: 'Posted yesterday',
    tags: ['Systems design', 'Brand', 'UX'],
    summary: 'Looking for design leaders who can shape storytelling, systems, and product experiences across retail channels.',
    description: 'We want a design leader who can bring a strong point of view around customer experience while scaling approachable systems across teams. This role blends product thinking, design operations, and brand storytelling.',
    lookingFor: [
      'Design leaders with portfolio depth in product and brand design.',
      'Comfortable partnering with product and engineering leaders.',
      'Strong storytelling, facilitation, and systems thinking ability.'
    ],
    profile: [
      'Modern retail team with a strong focus on customer experience.',
      'Hiring for design systems and product design leadership.',
      'Values craft, clarity, and thoughtful collaboration.'
    ]
  },
  {
    id: 5,
    name: 'Samir Patel',
    title: 'Founding Recruiter',
    company: 'Velvet Grid',
    location: 'Remote',
    function: 'Sales',
    experience: 'Mid',
    responseHours: 16,
    match: 93,
    date: 'Active now',
    tags: ['B2B sales', 'Pipeline', 'Enterprise'],
    summary: 'Hiring relationship-first sales talent for creator-focused enterprise accounts and partner channels.',
    description: 'We are building a sharp, founder-led sales motion for a high-velocity startup. We care most about curiosity, grit, and the ability to build trust with customers while solving meaningful business problems.',
    lookingFor: [
      'Sales talent with enterprise or SaaS experience.',
      'Strong discovery and consultative selling instincts.',
      'A bias toward relationship building and multi-threaded pipeline creation.'
    ],
    profile: [
      'Early-stage growth team optimizing outbound and channel sales.',
      'Open to product-minded sales operators who enjoy working closely with founders.',
      'Strong interest in candidate quality and long-term retention.'
    ]
  },
  {
    id: 6,
    name: 'Jordan Lee',
    title: 'Principal ML Engineer',
    company: 'Signal Loop',
    location: 'Hybrid',
    function: 'Engineering',
    experience: 'Leadership',
    responseHours: 24,
    match: 90,
    date: 'Posted 1d ago',
    tags: ['ML systems', 'MLOps', 'Recommendations'],
    summary: 'Looking for senior machine learning engineers to build personalization systems that shape customer outcomes.',
    description: 'We are expanding our ML platform with a focus on high-impact recommendation and personalization products. The right candidate will be highly hands-on, collaborative, and able to connect technical experimentation to business value.',
    lookingFor: [
      'Engineers with practical ML production experience and model deployment expertise.',
      'People who care about experimentation quality and thoughtful evaluation.',
      'Strong communication skills across product, engineering, and leadership teams.'
    ],
    profile: [
      'Focused on product-scale recommendation and personalization systems.',
      'Strong focus on practical MLOps and observability in production.',
      'Seeks thoughtful collaborators who can operate across ambiguity.'
    ]
  }
];

const state = {
  query: '',
  location: 'all',
  function: 'all',
  experience: 'all',
  responseHours: 12,
  saved: new Set(),
  selectedId: profiles[0].id
};

const elements = {
  keywordSearch: document.querySelector('#keyword-search'),
  locationFilter: document.querySelector('#location-filter'),
  functionFilter: document.querySelector('#function-filter'),
  experienceFilter: document.querySelector('#experience-filter'),
  responseFilter: document.querySelector('#response-filter'),
  responseValue: document.querySelector('.salary-value'),
  jobsList: document.querySelector('#jobs-list'),
  resultsCount: document.querySelector('#results-count'),
  resultsTitle: document.querySelector('#results-title'),
  savedCount: document.querySelector('#saved-count'),
  detail: document.querySelector('#job-detail'),
  resetFilters: document.querySelector('#reset-filters')
};

function formatMatch(value) {
  return `${value}% match`;
}

function getFilteredProfiles() {
  return profiles.filter((profile) => {
    const matchesQuery =
      state.query === '' ||
      [profile.name, profile.title, profile.company, profile.summary, ...profile.tags]
        .join(' ')
        .toLowerCase()
        .includes(state.query.toLowerCase());

    const matchesLocation = state.location === 'all' || profile.location === state.location;
    const matchesFunction = state.function === 'all' || profile.function === state.function;
    const matchesExperience = state.experience === 'all' || profile.experience === state.experience;
    const matchesResponse = profile.responseHours <= state.responseHours;

    return matchesQuery && matchesLocation && matchesFunction && matchesExperience && matchesResponse;
  });
}

function renderProfiles() {
  const filteredProfiles = getFilteredProfiles();

  if (filteredProfiles.length === 0) {
    elements.jobsList.innerHTML = `
      <div class="job-card">
        <p class="job-description">No hiring managers match your filters right now. Try broadening the search or resetting your filters.</p>
      </div>
    `;
    elements.resultsCount.textContent = '0 profiles';
    elements.resultsTitle.textContent = 'No matches';
    return;
  }

  const selectedProfile = filteredProfiles.find((profile) => profile.id === state.selectedId) || filteredProfiles[0];
  state.selectedId = selectedProfile.id;

  elements.jobsList.innerHTML = filteredProfiles
    .map(
      (profile) => `
        <article class="job-card ${profile.id === state.selectedId ? 'selected' : ''}" data-id="${profile.id}">
          <div class="card-top">
            <div class="company-stack">
              <div class="company-badge">${profile.company.slice(0, 1)}</div>
              <div>
                <p class="eyebrow">${profile.company}</p>
                <h3 class="job-title">${profile.name} • ${profile.title}</h3>
              </div>
            </div>
            <button class="save-button ${state.saved.has(profile.id) ? 'saved' : ''}" data-save-id="${profile.id}" type="button" aria-label="Save profile">
              ${state.saved.has(profile.id) ? '★' : '☆'}
            </button>
          </div>

          <div class="meta-row">
            <span>${profile.location}</span>
            <span class="dot-separator">•</span>
            <span>${profile.function}</span>
            <span class="dot-separator">•</span>
            <span>${profile.experience}</span>
            <span class="dot-separator">•</span>
            <span>${profile.date}</span>
          </div>

          <p class="job-description">${profile.summary}</p>

          <div class="card-bottom">
            <div class="tag-list">
              ${profile.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <span class="salary-pill">${formatMatch(profile.match)}</span>
          </div>
        </article>
      `
    )
    .join('');

  elements.resultsCount.textContent = `${filteredProfiles.length} ${filteredProfiles.length === 1 ? 'profile' : 'profiles'}`;
  elements.resultsTitle.textContent = filteredProfiles.length > 1 ? 'Top profiles' : 'Single profile';
  renderDetail(selectedProfile);
  bindCardEvents();
  updateSavedCount();
}

function renderDetail(profile) {
  if (!profile) {
    elements.detail.innerHTML = '<p class="job-detail-empty">Select a profile to view the full hiring context.</p>';
    return;
  }

  elements.detail.innerHTML = `
    <div class="detail-card">
      <div class="job-detail-header">
        <div>
          <p class="eyebrow">${profile.company}</p>
          <h2 class="detail-title">${profile.name}</h2>
          <p class="detail-company">${profile.title} • ${profile.location} • ${profile.function}</p>
        </div>
        <button class="save-button ${state.saved.has(profile.id) ? 'saved' : ''}" data-save-id="${profile.id}" type="button" aria-label="Save profile">
          ${state.saved.has(profile.id) ? '★' : '☆'}
        </button>
      </div>

      <div class="detail-meta">
        <span>${profile.date}</span>
        <span>•</span>
        <span>Responds within ${profile.responseHours}h</span>
        <span>•</span>
        <span>${formatMatch(profile.match)}</span>
      </div>

      <div class="job-action-row">
        <span class="salary-pill">${profile.experience}</span>
        <button class="apply-button" type="button">Message</button>
      </div>

      <div class="section-block">
        <h3>Post</h3>
        <p class="job-description">${profile.description}</p>
      </div>

      <div class="section-block">
        <h3>What they are looking for</h3>
        <ul>
          ${profile.lookingFor.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <div class="section-block">
        <h3>Hiring context</h3>
        <ul>
          ${profile.profile.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  elements.detail.querySelectorAll('[data-save-id]').forEach((button) => {
    button.addEventListener('click', () => toggleSaved(Number(button.dataset.saveId)));
  });
}

function bindCardEvents() {
  elements.jobsList.querySelectorAll('.job-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-save-id]')) {
        return;
      }
      state.selectedId = Number(card.dataset.id);
      renderProfiles();
    });
  });

  elements.jobsList.querySelectorAll('[data-save-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSaved(Number(button.dataset.saveId));
    });
  });
}

function toggleSaved(profileId) {
  if (state.saved.has(profileId)) {
    state.saved.delete(profileId);
  } else {
    state.saved.add(profileId);
  }

  renderProfiles();
}

function updateSavedCount() {
  elements.savedCount.textContent = state.saved.size;
}

function bindFilters() {
  elements.keywordSearch.addEventListener('input', (event) => {
    state.query = event.target.value.trim();
    renderProfiles();
  });

  elements.locationFilter.addEventListener('change', (event) => {
    state.location = event.target.value;
    renderProfiles();
  });

  elements.functionFilter.addEventListener('change', (event) => {
    state.function = event.target.value;
    renderProfiles();
  });

  elements.experienceFilter.addEventListener('change', (event) => {
    state.experience = event.target.value;
    renderProfiles();
  });

  elements.responseFilter.addEventListener('input', (event) => {
    state.responseHours = Number(event.target.value);
    elements.responseValue.textContent = `Within ${state.responseHours}h`;
    renderProfiles();
  });

  elements.resetFilters.addEventListener('click', () => {
    state.query = '';
    state.location = 'all';
    state.function = 'all';
    state.experience = 'all';
    state.responseHours = 12;

    elements.keywordSearch.value = '';
    elements.locationFilter.value = 'all';
    elements.functionFilter.value = 'all';
    elements.experienceFilter.value = 'all';
    elements.responseFilter.value = '12';
    elements.responseValue.textContent = 'Within 12h';
    renderProfiles();
  });
}

bindFilters();
renderProfiles();
