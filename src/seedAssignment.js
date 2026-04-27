require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const connectDB  = require('./config/db');
const Assignment = require('./models/Assignment');
const Batch      = require('./models/Batch');
const Mentor     = require('./models/Mentor');

// ─── READING & WRITING MODULE 1 — 27 questions ────────────────────────────────
const rwModule1Questions = [
  // ── Words in Context (Q1–Q5) ──────────────────────────────────────────────
  {
    number: 1,
    passage: `<p>The following text is adapted from Sadakichi Hartmann's 1894 short story <em>Magnolia Blossoms</em>.</p><p>What a night it was! My soul had left its body to lose itself in the wild unrestrained beauty around me—from where it came—and only left a trembling <u>suggestion</u> of its existence within me.</p>`,
    image: null,
    question: "As used in the text, what does the word \"suggestion\" most nearly mean?",
    choices: { A: 'Trace', B: 'Opinion', C: 'Dispute', D: 'Command' },
    correctAnswer: 'A',
    explanation: "'Suggestion' here means a faint trace or hint — the soul barely remained, leaving only a trembling trace of its presence.",
  },
  {
    number: 2,
    passage: `<p>The following text is adapted from a 2023 article on urban ecology.</p><p>The new catalyst significantly <u>expedited</u> the chemical reaction in the laboratory setting, reducing the time needed from several hours to mere minutes and opening new possibilities for industrial application.</p>`,
    image: null,
    question: "As used in the text, what does the word \"expedited\" most nearly mean?",
    choices: { A: 'Complicated', B: 'Reversed', C: 'Accelerated', D: 'Interrupted' },
    correctAnswer: 'C',
    explanation: "'Expedited' means made faster or accelerated. The reaction time decreased, confirming the meaning of speeding up.",
  },
  {
    number: 3,
    passage: `<p>The following text is adapted from a history of European diplomacy.</p><p>The treaty was seen as an act of <u>capitulation</u> by nationalist factions, who believed the government had surrendered too many territorial concessions to appease foreign powers.</p>`,
    image: null,
    question: "As used in the text, what does the word \"capitulation\" most nearly mean?",
    choices: { A: 'Celebration', B: 'Negotiation', C: 'Surrender', D: 'Expansion' },
    correctAnswer: 'C',
    explanation: "'Capitulation' means the act of surrendering or giving in. The nationalists believed the government gave too much away.",
  },
  {
    number: 4,
    passage: `<p>The following text is adapted from a 2022 sociology paper.</p><p>The sociologist argued that the community's <u>cohesion</u> was undermined by the rapid influx of new residents who had little connection to local traditions and shared history.</p>`,
    image: null,
    question: "As used in the text, what does the word \"cohesion\" most nearly mean?",
    choices: { A: 'Isolation', B: 'Unity', C: 'Authority', D: 'Diversity' },
    correctAnswer: 'B',
    explanation: "'Cohesion' refers to the state of unity or sticking together within a group. The sociologist argues this unity was weakened.",
  },
  {
    number: 5,
    passage: `<p>The following text is adapted from a 2021 memoir.</p><p>In her memoir, Reyes describes her childhood home as a sanctuary — a place where the chaos of the outside world seemed entirely <u>remote</u>, as though the house existed in its own separate dimension of calm.</p>`,
    image: null,
    question: "As used in the text, what does the word \"remote\" most nearly mean?",
    choices: { A: 'Distant', B: 'Unlikely', C: 'Silent', D: 'Forbidden' },
    correctAnswer: 'A',
    explanation: "'Remote' here means distant or far away — the chaos of the outside world felt far from her home.",
  },

  // ── Text Structure and Purpose (Q6–Q9) ────────────────────────────────────
  {
    number: 6,
    passage: `<p>Contrary to popular belief, the Great Wall of China is not visible from space with the naked eye. The wall is simply too narrow — averaging only 15 to 30 feet wide — to be seen from such a distance. In fact, many astronauts have confirmed that they could not spot it during their missions.</p>`,
    image: null,
    question: "What is the primary purpose of the text?",
    choices: {
      A: 'To describe the architectural features of the Great Wall of China',
      B: 'To correct a widely held misconception about the Great Wall of China',
      C: 'To argue that the Great Wall of China is an engineering failure',
      D: 'To explain how astronauts observe landmarks from space',
    },
    correctAnswer: 'B',
    explanation: "The passage's entire purpose is to address and disprove the popular myth that the Great Wall is visible from space.",
  },
  {
    number: 7,
    passage: `<p>Scientists have long debated whether dinosaurs were warm-blooded or cold-blooded. Recent isotopic analysis of dinosaur bones suggests a metabolic rate somewhere between modern reptiles and birds — neither fully ectothermic nor fully endothermic. This middle-ground hypothesis has reshaped how paleontologists model dinosaur behavior and ecology.</p>`,
    image: null,
    question: "What is the function of the final sentence in the text?",
    choices: {
      A: 'To introduce a new argument that contradicts the hypothesis',
      B: 'To describe the methods used in isotopic analysis',
      C: 'To explain the broader significance of the middle-ground hypothesis',
      D: 'To question the reliability of the new findings',
    },
    correctAnswer: 'C',
    explanation: "The final sentence explains the impact of the hypothesis — it reshaped paleontology models — conveying its broader significance.",
  },
  {
    number: 8,
    passage: `<p>Urban farming has been praised as a sustainable solution to food insecurity. Proponents argue that rooftop gardens and vertical farms can bring fresh produce to food deserts. Critics, however, point out that the energy costs of controlled-environment agriculture often exceed those of conventional farming, making the environmental calculus more complex than advocates acknowledge.</p>`,
    image: null,
    question: "The author's perspective on urban farming is best described as:",
    choices: {
      A: 'Strongly supportive, emphasizing its benefits for food deserts',
      B: 'Strongly critical, arguing that energy costs make it unsustainable',
      C: 'Balanced, presenting both the benefits and the limitations',
      D: 'Indifferent, suggesting the debate is not worth resolving',
    },
    correctAnswer: 'C',
    explanation: "The passage presents advocates' view (sustainable, addresses food deserts) and critics' view (energy costs), taking neither side.",
  },
  {
    number: 9,
    passage: `<p>The following text is adapted from a 2020 article on sleep science.</p><p>Researchers have established a strong correlation between chronic sleep deprivation and impaired immune function. Those who sleep fewer than six hours per night show a significantly reduced production of cytokines, the proteins that help coordinate the body's response to infection. This finding has prompted calls for revised public health guidelines on sleep duration.</p>`,
    image: null,
    question: "Which choice best describes the overall structure of the text?",
    choices: {
      A: 'A hypothesis is proposed, then refuted by experimental evidence',
      B: 'A finding is presented, its mechanism explained, and its implications noted',
      C: 'A controversy is introduced, then resolved through expert consensus',
      D: 'A personal anecdote is used to illustrate a broader scientific principle',
    },
    correctAnswer: 'B',
    explanation: "The text presents the finding (sleep deprivation impairs immunity), explains the mechanism (reduced cytokines), then notes the implication (calls for revised guidelines).",
  },

  // ── Cross-Text Connections (Q10–Q11) ──────────────────────────────────────
  {
    number: 10,
    passage: `<p><strong>Text 1:</strong> The introduction of the printing press in the fifteenth century democratized access to information, enabling ideas to spread across Europe at unprecedented speed and fueling the Renaissance and Reformation.</p><p><strong>Text 2:</strong> While the printing press is often celebrated for spreading knowledge, historians must acknowledge that it also facilitated the rapid dissemination of misinformation, propaganda, and inflammatory religious tracts that contributed to violent conflict.</p>`,
    image: null,
    question: "How do the two texts most meaningfully relate to each other?",
    choices: {
      A: 'Text 2 provides statistical evidence that supports the claim in Text 1.',
      B: 'Text 2 complicates the celebratory view of the printing press presented in Text 1.',
      C: 'Text 2 argues that the printing press had no positive effects.',
      D: 'Text 2 focuses on economic impacts while Text 1 focuses on social impacts.',
    },
    correctAnswer: 'B',
    explanation: "Text 1 celebrates the printing press. Text 2 acknowledges its positive role but adds a darker dimension — complicating, not fully contradicting, Text 1.",
  },
  {
    number: 11,
    passage: `<p><strong>Text 1:</strong> Biodiversity is essential for ecosystem resilience. When a single species dominates, ecosystems become fragile and vulnerable to collapse under environmental stress.</p><p><strong>Text 2:</strong> Research on island ecosystems demonstrates that even habitats with very limited species diversity can achieve stable equilibria, provided environmental conditions remain consistent over time.</p>`,
    image: null,
    question: "Based on both texts, which statement best describes their relationship?",
    choices: {
      A: 'Both texts agree that biodiversity is always necessary for ecosystem stability.',
      B: 'Text 1 argues that low diversity leads to fragility; Text 2 shows stability can occur with low diversity under certain conditions.',
      C: 'Text 2 fully refutes the claims made in Text 1 with direct contradictory evidence.',
      D: 'Both texts use island ecosystems as their primary case study.',
    },
    correctAnswer: 'B',
    explanation: "Text 1 links low diversity to fragility. Text 2 presents a conditional counterexample — stability with low diversity is possible but depends on stable conditions.",
  },

  // ── Central Ideas and Command of Evidence (Q12–Q16) ───────────────────────
  {
    number: 12,
    passage: `<p>The gig economy has transformed how millions of workers earn a living, offering flexibility that traditional employment rarely provides. However, this flexibility comes at a cost: gig workers typically lack access to employer-sponsored health insurance, retirement benefits, and paid leave. As a result, many workers find themselves choosing between autonomy and security.</p>`,
    image: null,
    question: "Which choice best states the main idea of the text?",
    choices: {
      A: 'The gig economy is more profitable than traditional employment for most workers.',
      B: 'Traditional employment offers more stability but fewer opportunities than gig work.',
      C: 'The gig economy offers flexibility but leaves workers without important protections.',
      D: 'Workers in the gig economy are primarily motivated by financial gain.',
    },
    correctAnswer: 'C',
    explanation: "The passage presents both the benefit (flexibility) and the cost (lack of benefits) of gig work. Choice C captures both accurately.",
  },
  {
    number: 13,
    passage: `<p>Migration patterns of monarch butterflies are among nature's most remarkable phenomena. These insects travel up to 3,000 miles from Canada and the United States to their overwintering grounds in Mexico — a journey guided not by memory, but by a magnetic compass and the position of the sun. What makes this even more astonishing is that no individual butterfly completes a round trip; it takes multiple generations to complete the full cycle.</p>`,
    image: null,
    question: "According to the text, which of the following is true about monarch butterfly migration?",
    choices: {
      A: 'Individual butterflies complete a full round trip each year.',
      B: 'Monarch butterflies rely on memory to navigate their route.',
      C: 'The complete migration cycle spans multiple butterfly generations.',
      D: 'Monarch butterflies travel primarily within the United States.',
    },
    correctAnswer: 'C',
    explanation: "The text explicitly states: 'no individual butterfly completes a round trip; it takes multiple generations to complete the full cycle.'",
  },
  {
    number: 14,
    passage: `<p>Historians have long debated whether Cleopatra VII was primarily a political strategist or a cultural diplomat. While her alliances with Julius Caesar and Mark Antony are well documented, recent scholarship emphasizes her mastery of multiple languages — including Egyptian, Ethiopian, and Greek — as evidence of deliberate cultural bridge-building. She was reportedly the first Ptolemaic ruler to learn the Egyptian language at all.</p>`,
    image: null,
    question: "Which quotation from the text best supports the claim that Cleopatra's abilities were deliberately strategic?",
    choices: {
      A: '"her alliances with Julius Caesar and Mark Antony are well documented"',
      B: '"recent scholarship emphasizes her mastery of multiple languages... as evidence of deliberate cultural bridge-building"',
      C: '"She was reportedly the first Ptolemaic ruler to learn the Egyptian language at all"',
      D: '"Historians have long debated whether Cleopatra VII was primarily a political strategist or a cultural diplomat"',
    },
    correctAnswer: 'B',
    explanation: "Choice B explicitly frames her language skills as 'deliberate cultural bridge-building' — the word 'deliberate' directly signals strategic intent.",
  },
  {
    number: 15,
    passage: `<p>A 2024 study surveyed 1,200 remote workers across five countries. The researchers found that 67% of respondents reported higher job satisfaction compared to when they worked in an office, while 42% noted a decline in collaboration with colleagues. Notably, 81% said they would decline a job that did not offer remote work options.</p>`,
    image: null,
    question: "Which claim is most directly supported by the data presented in the passage?",
    choices: {
      A: 'Most remote workers are less productive than office workers.',
      B: 'Remote work improves satisfaction but is associated with reduced collaboration for many workers.',
      C: 'The majority of workers prefer office environments for collaboration.',
      D: 'Remote workers earn higher salaries than their office-based counterparts.',
    },
    correctAnswer: 'B',
    explanation: "67% reported higher satisfaction and 42% reported a decline in collaboration — both figures directly support choice B.",
  },
  {
    number: 16,
    passage: `<p>When paleontologists first discovered fossils of <em>Deinonychus</em> in the 1960s, they revised long-held assumptions about dinosaur behavior. The animal's anatomy — a large brain relative to body size, grasping forelimbs, and evidence of pack hunting — suggested a level of intelligence and social organization that contradicted the image of dinosaurs as slow, dim-witted reptiles.</p>`,
    image: null,
    question: "Which inference is most directly supported by the text?",
    choices: {
      A: 'Deinonychus was the largest predatory dinosaur known to paleontologists.',
      B: 'Before the 1960s, scientists generally viewed dinosaurs as unintelligent animals.',
      C: 'Pack hunting behavior is unique to Deinonychus among all dinosaurs.',
      D: 'The discovery of Deinonychus proved that all dinosaurs were warm-blooded.',
    },
    correctAnswer: 'B',
    explanation: "The text says Deinonychus 'contradicted the image of dinosaurs as slow, dim-witted reptiles' — implying that was the prevailing view before its discovery.",
  },

  // ── Inferences (Q17–Q18) ──────────────────────────────────────────────────
  {
    number: 17,
    passage: `<p>Despite the proliferation of digital news sources, studies show that readers who consume news exclusively online tend to engage with a narrower range of topics than those who read print newspapers. Print readers, who encounter headlines across diverse sections, are more likely to read stories outside their habitual interests.</p>`,
    image: null,
    question: "What does the author most likely suggest about digital news consumption?",
    choices: {
      A: 'Digital news is less accurate than print news.',
      B: 'Online readers may inadvertently limit the breadth of their news diet.',
      C: 'Print newspapers will eventually replace digital news sources.',
      D: 'Digital news readers are less educated than print news readers.',
    },
    correctAnswer: 'B',
    explanation: "The passage implies online readers encounter a narrower range of topics — suggesting they may unintentionally limit what news they consume.",
  },
  {
    number: 18,
    passage: `<p>The success of the Oslo Accords in 1993 was hailed as a breakthrough in Middle Eastern diplomacy. However, critics have since argued that the agreement failed to resolve the most contentious issues — including the status of Jerusalem and the right of return for Palestinian refugees — leaving them for 'final status' negotiations that never reached a conclusion.</p>`,
    image: null,
    question: "Based on the text, what can be inferred about the Oslo Accords?",
    choices: {
      A: 'The Oslo Accords resulted in a permanent and comprehensive peace agreement.',
      B: 'The Oslo Accords definitively resolved the status of Jerusalem.',
      C: 'The most difficult issues in the conflict were left unresolved by the Oslo Accords.',
      D: 'Critics widely praised the Oslo Accords for their long-term effectiveness.',
    },
    correctAnswer: 'C',
    explanation: "The text states the most contentious issues were left for negotiations 'that never reached a conclusion' — clearly implying they remain unresolved.",
  },

  // ── Standard English Conventions (Q19–Q23) ────────────────────────────────
  {
    number: 19,
    passage: `<p>Dr. Patel submitted her research paper last Tuesday, ______ the editors responded with detailed revisions within a week.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'Tuesday, and', B: 'Tuesday and', C: 'Tuesday; and', D: 'Tuesday:' },
    correctAnswer: 'A',
    explanation: "Two independent clauses joined by the coordinating conjunction 'and' require a comma before it. 'Tuesday, and the editors responded' is correct.",
  },
  {
    number: 20,
    passage: `<p>The researchers, ______ had spent three years collecting data, were disappointed when the funding agency declined to renew their grant.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'which', B: 'who', C: 'whom', D: 'whose' },
    correctAnswer: 'B',
    explanation: "'Who' is the correct relative pronoun for people (the researchers). 'Which' is for non-human nouns.",
  },
  {
    number: 21,
    passage: `<p>Each of the participating countries ______ agreed to reduce carbon emissions by 30% before the end of the decade.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'have', B: 'has', C: 'having', D: 'had been' },
    correctAnswer: 'B',
    explanation: "The subject is 'Each' (singular), not 'countries.' Singular subjects require singular verbs: 'Each... has agreed.'",
  },
  {
    number: 22,
    passage: `<p>The museum's new exhibit on ancient civilizations ______ thousands of visitors since it opened in January.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'attracts', B: 'attracted', C: 'has attracted', D: 'attracting' },
    correctAnswer: 'C',
    explanation: "'Has attracted' (present perfect) is correct because the action started in the past (January) and continues to the present. Simple past 'attracted' would imply it no longer attracts visitors.",
  },
  {
    number: 23,
    passage: `<p>Known for ______ ability to adapt to extreme environments, tardigrades can survive temperatures ranging from near absolute zero to above 300°F.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'their', B: 'there', C: 'its', D: 'they\'re' },
    correctAnswer: 'A',
    explanation: "'Their' is the correct possessive pronoun referring to 'tardigrades' (plural). 'There' is an adverb, 'they're' is a contraction, and 'its' would be singular.",
  },

  // ── Expression of Ideas — Transitions (Q24–Q25) ───────────────────────────
  {
    number: 24,
    passage: `<p>Solar energy has become increasingly cost-competitive with fossil fuels over the past decade. ______, the intermittency of solar power — its inability to generate electricity at night or on cloudy days — remains a significant barrier to widespread adoption.</p>`,
    image: null,
    question: "Which choice completes the text with the most logical transition?",
    choices: { A: 'As a result', B: 'For instance', C: 'Nevertheless', D: 'Similarly' },
    correctAnswer: 'C',
    explanation: "'Nevertheless' signals a contrast — solar energy is cost-competitive, but it still faces the barrier of intermittency. The contrast makes 'nevertheless' the logical choice.",
  },
  {
    number: 25,
    passage: `<p>The early experiments with penicillin were largely inconclusive. ______, Alexander Fleming's persistent investigation eventually revealed the antibiotic properties of the mold, transforming modern medicine.</p>`,
    image: null,
    question: "Which choice completes the text with the most logical transition?",
    choices: { A: 'Therefore', B: 'Likewise', C: 'In contrast', D: 'Ultimately' },
    correctAnswer: 'D',
    explanation: "'Ultimately' correctly signals that despite the early inconclusive results, the final outcome was a major discovery. It bridges the initial failure with the eventual success.",
  },

  // ── Rhetorical Synthesis (Q26–Q27) ────────────────────────────────────────
  {
    number: 26,
    passage: `<p>A student is writing a report about ocean plastic pollution and has taken the following notes:</p><ul><li>An estimated 8 million metric tons of plastic enter the ocean each year.</li><li>Plastic pollution harms marine life through ingestion and entanglement.</li><li>Microplastics have been found in fish consumed by humans.</li><li>Several countries have banned single-use plastics to reduce ocean waste.</li></ul>`,
    image: null,
    question: "Which choice most effectively uses relevant information from the notes to emphasize the threat plastic pollution poses to human health?",
    choices: {
      A: 'Ocean plastic pollution is a growing global problem, with 8 million metric tons entering the ocean annually.',
      B: 'Several countries have responded to ocean plastic pollution by banning single-use plastics.',
      C: 'Because microplastics have been found in fish that humans eat, ocean plastic pollution may pose a direct threat to human health.',
      D: 'Plastic pollution harms marine life through ingestion and entanglement, threatening biodiversity.',
    },
    correctAnswer: 'C',
    explanation: "The question asks specifically about the threat to human health. Only choice C connects microplastics in fish directly to human health risk.",
  },
  {
    number: 27,
    passage: `<p>A student is writing an essay about the benefits of bilingual education and has gathered these notes:</p><ul><li>Bilingual children demonstrate enhanced executive function compared to monolingual peers.</li><li>Learning two languages simultaneously can delay the onset of dementia by an average of 4–5 years.</li><li>Bilingual education programs improve academic performance in other subjects.</li><li>Bilingual individuals have broader career opportunities in the global economy.</li></ul>`,
    image: null,
    question: "Which choice most effectively uses relevant information from the notes to argue that bilingual education has long-term cognitive benefits?",
    choices: {
      A: 'Bilingual education improves academic performance and opens up broader career opportunities in the global economy.',
      B: 'Research shows that speaking two languages can delay the onset of dementia by 4–5 years, demonstrating a lasting cognitive benefit of bilingualism.',
      C: 'Bilingual children show enhanced executive function, which helps them succeed in school.',
      D: 'Bilingual individuals enjoy many advantages, including career opportunities and academic success.',
    },
    correctAnswer: 'B',
    explanation: "The question asks for long-term cognitive benefits specifically. Delaying dementia by 4–5 years is the clearest example of a long-term cognitive benefit among the options.",
  },
];

// ─── READING & WRITING MODULE 2 — 27 questions ────────────────────────────────
const rwModule2Questions = [
  // ── Words in Context (Q1–Q5) ──────────────────────────────────────────────
  {
    number: 1,
    passage: `<p>The following text is adapted from a 2022 essay on environmental policy.</p><p>The committee's <u>tentative</u> agreement on emissions targets was welcomed by climate advocates, who nonetheless cautioned that the deal's vague language left significant room for interpretation.</p>`,
    image: null,
    question: "As used in the text, what does the word \"tentative\" most nearly mean?",
    choices: { A: 'Definitive', B: 'Provisional', C: 'Ambitious', D: 'Celebrated' },
    correctAnswer: 'B',
    explanation: "'Tentative' means not fully worked out or provisional. The vague language mentioned reinforces that the agreement was not fully settled.",
  },
  {
    number: 2,
    passage: `<p>The following text is adapted from a biography of Marie Curie.</p><p>Curie's <u>meticulous</u> record-keeping allowed later scientists to retrace her experimental steps and confirm her findings, a practice that became a model for scientific documentation.</p>`,
    image: null,
    question: "As used in the text, what does the word \"meticulous\" most nearly mean?",
    choices: { A: 'Careless', B: 'Innovative', C: 'Extremely careful and precise', D: 'Rapid' },
    correctAnswer: 'C',
    explanation: "'Meticulous' means showing great attention to detail. The fact that her records allowed replication confirms the meaning of careful precision.",
  },
  {
    number: 3,
    passage: `<p>The following text is adapted from a 2020 article on economics.</p><p>The sudden drop in consumer confidence had a <u>pernicious</u> effect on small businesses, many of which were already operating on thin profit margins and could not absorb the sudden decline in sales.</p>`,
    image: null,
    question: "As used in the text, what does the word \"pernicious\" most nearly mean?",
    choices: { A: 'Temporary', B: 'Subtle', C: 'Harmful', D: 'Unexpected' },
    correctAnswer: 'C',
    explanation: "'Pernicious' means having a harmful effect, especially in a gradual or subtle way. The context — businesses unable to absorb the damage — confirms a harmful meaning.",
  },
  {
    number: 4,
    passage: `<p>The following text is adapted from a 2019 novel.</p><p>The detective's theory was <u>plausible</u> at first glance, but closer examination of the evidence revealed inconsistencies that cast serious doubt on her initial conclusions.</p>`,
    image: null,
    question: "As used in the text, what does the word \"plausible\" most nearly mean?",
    choices: { A: 'Unreasonable', B: 'Seemingly reasonable', C: 'Proven', D: 'Controversial' },
    correctAnswer: 'B',
    explanation: "'Plausible' means seeming reasonable or probable. The phrase 'at first glance' before the contrast suggests it initially appeared reasonable but later proved flawed.",
  },
  {
    number: 5,
    passage: `<p>The following text is adapted from a 2023 article on urban planning.</p><p>The architect's design was praised for its <u>ingenuity</u> — blending sustainable materials with a striking aesthetic that neither compromised structural integrity nor inflated the project's budget.</p>`,
    image: null,
    question: "As used in the text, what does the word \"ingenuity\" most nearly mean?",
    choices: { A: 'Extravagance', B: 'Cleverness', C: 'Simplicity', D: 'Durability' },
    correctAnswer: 'B',
    explanation: "'Ingenuity' refers to the quality of being clever or original. The design achieved multiple difficult goals simultaneously, reflecting clever thinking.",
  },

  // ── Text Structure and Purpose (Q6–Q9) ────────────────────────────────────
  {
    number: 6,
    passage: `<p>The octopus has long been regarded as one of the most intelligent invertebrates. These animals can solve multi-step puzzles, navigate mazes, and even unscrew jar lids to retrieve food. Most remarkably, their intelligence appears to have evolved independently from that of vertebrates, suggesting that complex cognition can arise through entirely different evolutionary pathways.</p>`,
    image: null,
    question: "What is the primary purpose of the final sentence in the text?",
    choices: {
      A: 'To introduce a new claim that contradicts the evidence presented earlier',
      B: 'To highlight the broader evolutionary significance of octopus intelligence',
      C: 'To suggest that octopuses are more intelligent than vertebrates',
      D: 'To explain the specific mechanisms behind octopus problem-solving',
    },
    correctAnswer: 'B',
    explanation: "The final sentence places octopus intelligence in a broader evolutionary context — its independent evolution suggests something significant about how cognition can develop.",
  },
  {
    number: 7,
    passage: `<p>The term "food desert" refers to areas where residents lack reasonable access to affordable, nutritious food. While the concept is widely used in public health policy, some researchers argue that the term is misleading: access to food is often present, but the food available is predominantly processed and nutrient-poor. These scholars prefer the term "food swamp" to describe such environments.</p>`,
    image: null,
    question: "What is the primary purpose of the text?",
    choices: {
      A: 'To argue that food deserts are a myth with no basis in public health research',
      B: 'To explain that some researchers believe "food desert" inadequately describes the real problem',
      C: 'To encourage policymakers to eliminate food deserts in urban areas',
      D: 'To compare the nutritional quality of food in urban and rural environments',
    },
    correctAnswer: 'B',
    explanation: "The passage explains a debate within research: 'food desert' may not capture the true problem, leading some scholars to prefer 'food swamp.' The purpose is to present this scholarly critique.",
  },
  {
    number: 8,
    passage: `<p>In the eighteenth century, the concept of a "public sphere" — spaces where citizens could gather to discuss politics and society — was celebrated by philosophers like Jürgen Habermas as the foundation of democratic discourse. Yet the coffee houses, salons, and clubs of this era were largely restricted to literate, property-owning men, excluding women, the poor, and enslaved people from civic participation.</p>`,
    image: null,
    question: "Which choice best describes how the text is organized?",
    choices: {
      A: 'A theory is proposed and then shown to be entirely false.',
      B: 'A historical concept is introduced and then qualified by noting its exclusions.',
      C: 'A philosopher is criticized for promoting an elitist idea.',
      D: 'Two competing theories of democracy are compared and contrasted.',
    },
    correctAnswer: 'B',
    explanation: "The text first introduces and celebrates the public sphere concept, then qualifies it by noting it excluded most of the population.",
  },
  {
    number: 9,
    passage: `<p>Antibiotics have saved millions of lives since their discovery in the twentieth century. However, their overuse — in medicine and agriculture — has accelerated the evolution of antibiotic-resistant bacteria. The World Health Organization now identifies antimicrobial resistance as one of the greatest threats to global health, warning that without intervention, common infections could once again become fatal.</p>`,
    image: null,
    question: "The author's attitude toward antibiotic use is best described as:",
    choices: {
      A: 'Fully supportive, emphasizing only the life-saving benefits',
      B: 'Sharply critical, arguing antibiotics should be banned in agriculture',
      C: 'Nuanced, acknowledging both benefits and the serious risks of overuse',
      D: 'Indifferent, presenting information without any evaluative stance',
    },
    correctAnswer: 'C',
    explanation: "The passage presents the life-saving benefit of antibiotics and the serious risk of overuse. The author takes a nuanced position, not an extreme one.",
  },

  // ── Cross-Text Connections (Q10–Q11) ──────────────────────────────────────
  {
    number: 10,
    passage: `<p><strong>Text 1:</strong> Space exploration is one of humanity's greatest achievements, pushing the boundaries of science and technology while inspiring generations of scientists and engineers.</p><p><strong>Text 2:</strong> The funds spent on space exploration could be more effectively directed toward addressing urgent earthly crises such as poverty, climate change, and public health infrastructure in developing nations.</p>`,
    image: null,
    question: "How do the two authors' perspectives on space exploration most meaningfully differ?",
    choices: {
      A: 'Text 1 focuses on scientific achievements; Text 2 focuses on economic costs.',
      B: 'Text 1 views space exploration as valuable; Text 2 questions whether those resources should be prioritized differently.',
      C: 'Text 1 argues space exploration causes climate change; Text 2 disagrees.',
      D: 'Both authors agree that space exploration benefits humanity.',
    },
    correctAnswer: 'B',
    explanation: "Text 1 celebrates space exploration as a great achievement. Text 2 argues the resources could be better used on earthly problems — a direct challenge to prioritization.",
  },
  {
    number: 11,
    passage: `<p><strong>Text 1:</strong> Standardized testing provides an objective, comparable measure of academic achievement across diverse schools and districts, helping identify achievement gaps.</p><p><strong>Text 2:</strong> Standardized tests reflect and reinforce systemic inequities. Students from wealthier families have access to expensive test preparation, giving them a measurable score advantage unrelated to actual academic ability.</p>`,
    image: null,
    question: "Based on the two texts, which statement would the author of Text 2 most likely make about Text 1?",
    choices: {
      A: 'Text 1 correctly identifies standardized testing as the best way to measure achievement gaps.',
      B: 'Text 1 fails to account for how socioeconomic factors affect test scores, undermining the claim of objectivity.',
      C: 'Text 1\'s argument about achievement gaps is irrelevant to educational policy.',
      D: 'Text 1 and Text 2 essentially agree that standardized tests are useful tools.',
    },
    correctAnswer: 'B',
    explanation: "Text 2's author argues that wealth enables test prep, making scores unequal regardless of ability — this directly challenges Text 1's claim that tests are 'objective.'",
  },

  // ── Central Ideas and Command of Evidence (Q12–Q16) ───────────────────────
  {
    number: 12,
    passage: `<p>The James Webb Space Telescope, launched in December 2021, represents a generational leap in astronomical observation. Its infrared sensors allow it to peer through clouds of dust that obscured earlier telescopes, revealing star-forming regions and distant galaxies with unprecedented clarity. Scientists anticipate that Webb's observations will fundamentally reshape models of the early universe.</p>`,
    image: null,
    question: "Which choice best states the main idea of the text?",
    choices: {
      A: 'The James Webb Space Telescope was launched in 2021 after decades of development.',
      B: 'Infrared sensors are the most important technology in modern astronomy.',
      C: 'The James Webb Space Telescope offers dramatic new observational capabilities that are expected to transform cosmological understanding.',
      D: 'Earlier telescopes were unable to observe any star-forming regions.',
    },
    correctAnswer: 'C',
    explanation: "The passage emphasizes Webb's superior capabilities (infrared, unprecedented clarity) and their expected scientific impact (reshaping models of the early universe).",
  },
  {
    number: 13,
    passage: `<p>Mangrove forests, found along tropical coastlines, are among the most carbon-dense ecosystems on Earth. Despite covering less than 1% of tropical forest area, mangroves store up to four times more carbon per unit area than rainforests. They also provide critical coastal protection, buffering communities from storm surges and erosion. Yet mangrove deforestation rates are five times higher than the global average for forests.</p>`,
    image: null,
    question: "Which detail from the text most effectively illustrates the disproportionate importance of mangroves relative to their size?",
    choices: {
      A: 'Mangroves are found along tropical coastlines.',
      B: 'Mangrove deforestation rates are five times the global average.',
      C: 'Mangroves store up to four times more carbon per unit area than rainforests, despite covering less than 1% of tropical forest area.',
      D: 'Mangroves provide coastal protection from storm surges.',
    },
    correctAnswer: 'C',
    explanation: "Choice C directly illustrates the disproportionate impact: a tiny fraction of forest area stores dramatically more carbon than larger ecosystems.",
  },
  {
    number: 14,
    passage: `<p>A 2023 meta-analysis reviewed 47 studies examining the relationship between screen time and adolescent mental health. The analysis found that adolescents who used social media for more than three hours per day were 2.4 times more likely to report symptoms of depression compared to those who used it for less than one hour. The association was stronger among girls than boys.</p>`,
    image: null,
    question: "Which claim is most directly supported by the data in the passage?",
    choices: {
      A: 'Social media causes depression in all adolescents who use it regularly.',
      B: 'High social media use is associated with a greater likelihood of depression symptoms, especially in girls.',
      C: 'Boys are entirely unaffected by social media use.',
      D: 'Adolescents should be prohibited from using social media.',
    },
    correctAnswer: 'B',
    explanation: "The data shows a 2.4× increased likelihood of depression with high usage, with a stronger association in girls — directly matching choice B.",
  },
  {
    number: 15,
    passage: `<p>The naturalist John Muir spent years advocating for the preservation of Yosemite Valley, eventually helping to establish it as a national park. His writings described nature as both spiritually restorative and intrinsically valuable — a perspective that influenced the early conservation movement. Critics, however, note that Muir's vision of "wilderness" often ignored the Indigenous communities that had lived in and managed these landscapes for centuries.</p>`,
    image: null,
    question: "Which choice best describes the overall structure of the passage?",
    choices: {
      A: 'A figure is praised without qualification for environmental activism.',
      B: 'A scientist\'s discoveries are introduced and then applied to modern problems.',
      C: 'A historical figure\'s contributions are presented alongside a significant criticism of his perspective.',
      D: 'Two conflicting scientific theories are introduced and compared.',
    },
    correctAnswer: 'C',
    explanation: "The passage presents Muir's contributions (conservation advocacy, national parks) and then qualifies them with a significant criticism (his erasure of Indigenous peoples).",
  },
  {
    number: 16,
    passage: `<p>In a study of 500 adults, researchers found that those who regularly practiced mindfulness meditation for at least 20 minutes per day reported a 35% reduction in perceived stress levels after eight weeks. Participants also demonstrated improved attention scores on standardized tests. A control group that received no mindfulness training showed no significant change in either measure.</p>`,
    image: null,
    question: "Which of the following conclusions is best supported by the study described in the text?",
    choices: {
      A: 'Mindfulness meditation eliminates stress completely.',
      B: 'Regular mindfulness practice may reduce perceived stress and improve attention.',
      C: 'The control group practiced a different form of stress reduction.',
      D: 'Mindfulness meditation is more effective than medication for treating stress.',
    },
    correctAnswer: 'B',
    explanation: "The study shows a 35% reduction in perceived stress and improved attention scores among meditators, compared to no change in the control group — directly supporting choice B.",
  },

  // ── Inferences (Q17–Q18) ──────────────────────────────────────────────────
  {
    number: 17,
    passage: `<p>The 1969 moon landing required an extraordinary convergence of scientific expertise, engineering innovation, and political will. NASA employed over 400,000 engineers, scientists, and technicians. At its peak, the Apollo program consumed nearly 4% of the federal budget — a level of public investment with few peacetime parallels in American history.</p>`,
    image: null,
    question: "Which inference is most directly supported by the text?",
    choices: {
      A: 'The Apollo program was funded primarily by private industry.',
      B: 'The moon landing would have been impossible without massive government funding and human resources.',
      C: 'Modern space programs require less funding than the Apollo program.',
      D: 'Political will was more important to the moon landing than scientific expertise.',
    },
    correctAnswer: 'B',
    explanation: "The text emphasizes the extraordinary scale of investment (400,000 people, 4% of budget) — implying the moon landing required this level of resources to succeed.",
  },
  {
    number: 18,
    passage: `<p>Although the novel's sales were initially modest, literary critics praised its unconventional structure and psychological depth. Within a decade, it had been translated into thirty languages and was assigned in literature courses worldwide. The author herself expressed surprise at its eventual reception, having originally written it as a personal project with no expectation of publication.</p>`,
    image: null,
    question: "Based on the text, which of the following can be reasonably inferred about the novel?",
    choices: {
      A: 'The novel was an immediate commercial success upon publication.',
      B: 'The author wrote the novel primarily to win literary awards.',
      C: 'The novel\'s recognition grew significantly over time, despite a slow initial reception.',
      D: 'Literary critics initially rejected the novel for its unconventional structure.',
    },
    correctAnswer: 'C',
    explanation: "The text states sales were 'initially modest' but the book was later translated into 30 languages and used in courses worldwide — clearly showing growth over time.",
  },

  // ── Standard English Conventions (Q19–Q23) ────────────────────────────────
  {
    number: 19,
    passage: `<p>The documentary ______ three major awards at the festival, including Best Picture and Best Original Score.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'winning', B: 'won', C: 'wins', D: 'to win' },
    correctAnswer: 'B',
    explanation: "'Won' is the correct simple past tense. The awards were received at a specific past event (the festival). 'Winning' is a participle, not a finite verb.",
  },
  {
    number: 20,
    passage: `<p>The committee reviewed all the proposals ______ submitting a final recommendation to the board.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'before', B: 'until', C: 'although', D: 'despite' },
    correctAnswer: 'A',
    explanation: "'Before' correctly establishes a temporal sequence: the committee reviewed proposals first, then submitted the recommendation.",
  },
  {
    number: 21,
    passage: `<p>Neither the lead researcher nor her assistants ______ available for comment when journalists arrived at the lab.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'was', B: 'were', C: 'are', D: 'is' },
    correctAnswer: 'B',
    explanation: "In 'neither...nor' constructions, the verb agrees with the noun closest to it. 'Assistants' is plural, so 'were' is correct.",
  },
  {
    number: 22,
    passage: `<p>The new policy requires all employees to submit ______ expense reports by the last Friday of each month.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'his or her', B: 'their', C: 'its', D: 'there' },
    correctAnswer: 'B',
    explanation: "'Their' is the correct plural possessive pronoun agreeing with 'all employees.' 'His or her' is technically singular and unnecessarily cumbersome in modern usage.",
  },
  {
    number: 23,
    passage: `<p>The bridge, ______ construction took nearly a decade, is now considered an engineering landmark.</p>`,
    image: null,
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: { A: 'who\'s', B: 'whose', C: 'which', D: 'that\'s' },
    correctAnswer: 'B',
    explanation: "'Whose' is the correct possessive relative pronoun. The bridge's construction took a decade — 'whose' shows possession for the non-human noun.",
  },

  // ── Expression of Ideas — Transitions and Rhetorical Synthesis (Q24–Q27) ──
  {
    number: 24,
    passage: `<p>The human brain contains approximately 86 billion neurons. ______, each neuron can form thousands of synaptic connections, resulting in a network of almost unimaginable complexity.</p>`,
    image: null,
    question: "Which choice completes the text with the most logical transition?",
    choices: { A: 'In contrast', B: 'Furthermore', C: 'However', D: 'As a result' },
    correctAnswer: 'B',
    explanation: "'Furthermore' adds information that builds on the previous point (86 billion neurons) to create a cumulative effect — emphasizing even greater complexity.",
  },
  {
    number: 25,
    passage: `<p>Early clinical trials of the vaccine produced promising results. ______, large-scale deployment revealed previously undetected side effects in a small percentage of patients, requiring regulators to issue updated safety guidelines.</p>`,
    image: null,
    question: "Which choice completes the text with the most logical transition?",
    choices: { A: 'Therefore', B: 'Similarly', C: 'However', D: 'As expected' },
    correctAnswer: 'C',
    explanation: "'However' correctly signals a contrast between the initial promising results and the unexpected side effects that emerged during large-scale deployment.",
  },
  {
    number: 26,
    passage: `<p>A student is writing a report about the benefits of public libraries and has gathered the following notes:</p><ul><li>Public libraries provide free access to books, internet, and educational resources.</li><li>Libraries offer after-school programs for children in underserved communities.</li><li>A 2022 survey found that 73% of Americans visited a public library in the past year.</li><li>Libraries serve as community gathering spaces and offer job search assistance.</li></ul>`,
    image: null,
    question: "Which choice most effectively uses relevant information from the notes to argue that public libraries reduce inequality?",
    choices: {
      A: '73% of Americans visited a public library in the past year, demonstrating high community engagement.',
      B: 'Public libraries are used by millions of Americans annually and offer a wide variety of services.',
      C: 'By providing free access to books, internet, educational resources, and after-school programs, public libraries give underserved communities access to opportunities they might otherwise lack.',
      D: 'Libraries serve as community gathering spaces and help residents find employment.',
    },
    correctAnswer: 'C',
    explanation: "Choice C specifically connects library services to underserved communities and frames them as reducing inequality — the most direct argument for that claim.",
  },
  {
    number: 27,
    passage: `<p>A student is writing an essay on the importance of arts education and has gathered these notes:</p><ul><li>Students who participate in arts programs show higher academic achievement in math and reading.</li><li>Arts education improves creative problem-solving and critical thinking skills.</li><li>Participation in school arts programs is associated with lower dropout rates.</li><li>Funding for arts programs has declined in many school districts over the past 20 years.</li></ul>`,
    image: null,
    question: "Which choice most effectively uses relevant information from the notes to argue that cutting arts programs is counterproductive to educational goals?",
    choices: {
      A: 'Arts education improves creative thinking, which is a valuable skill in the modern workforce.',
      B: 'Despite declining funding, arts programs remain popular among students and parents.',
      C: 'Because arts participation is linked to higher achievement in core subjects and lower dropout rates, cutting arts programs may undermine the very academic outcomes schools seek to improve.',
      D: 'Arts programs have been underfunded for 20 years, suggesting that schools do not prioritize creative education.',
    },
    correctAnswer: 'C',
    explanation: "Choice C directly makes the argument: arts programs support academic goals (higher achievement, lower dropout), so cutting them is counterproductive to those same goals.",
  },
];

// ─── MATH MODULE 1 — 22 questions ─────────────────────────────────────────────
const mathModule1Questions = [
  // ── Algebra — Linear Equations and Systems (Q1–Q7) ────────────────────────
  {
    number: 1,
    passage: null,
    image: null,
    question: "If 5x − 3 = 22, what is the value of x?",
    choices: { A: '4', B: '5', C: '6', D: '7' },
    correctAnswer: 'B',
    explanation: "5x = 22 + 3 = 25, so x = 5.",
  },
  {
    number: 2,
    passage: null,
    image: null,
    question: "Which of the following is the solution to the system of equations?\n\n2x + y = 10\nx − y = 2",
    choices: { A: 'x = 3, y = 4', B: 'x = 4, y = 2', C: 'x = 5, y = 0', D: 'x = 2, y = 6' },
    correctAnswer: 'B',
    explanation: "Adding the two equations: 3x = 12, so x = 4. Substituting: 2(4) + y = 10, y = 2.",
  },
  {
    number: 3,
    passage: null,
    image: null,
    question: "A taxi charges a flat fee of $3.50 plus $2.25 per mile. Which equation represents the total cost C for a ride of m miles?",
    choices: { A: 'C = 2.25m', B: 'C = 3.50 + 2.25m', C: 'C = 3.50m + 2.25', D: 'C = 2.25 + 3.50' },
    correctAnswer: 'B',
    explanation: "The flat fee ($3.50) is a fixed cost; the per-mile rate ($2.25) multiplies by the number of miles. Total cost = 3.50 + 2.25m.",
  },
  {
    number: 4,
    passage: null,
    image: null,
    question: "If 3(x + 4) = 2x + 19, what is the value of x?",
    choices: { A: '5', B: '6', C: '7', D: '8' },
    correctAnswer: 'C',
    explanation: "3x + 12 = 2x + 19 → x = 7.",
  },
  {
    number: 5,
    passage: null,
    image: null,
    question: "Which of the following inequalities has the solution set x > 3?\n",
    choices: { A: '2x − 6 < 0', B: '2x − 6 > 0', C: '−2x + 6 > 0', D: 'x + 3 < 0' },
    correctAnswer: 'B',
    explanation: "2x − 6 > 0 → 2x > 6 → x > 3.",
  },
  {
    number: 6,
    passage: null,
    image: null,
    question: "Line ℓ passes through the points (0, 4) and (3, 10). What is the slope of line ℓ?",
    choices: { A: '1', B: '2', C: '3', D: '4' },
    correctAnswer: 'B',
    explanation: "Slope = (10 − 4) / (3 − 0) = 6/3 = 2.",
  },
  {
    number: 7,
    passage: null,
    image: null,
    question: "A store sells apples for $0.75 each and oranges for $1.25 each. Sara spent exactly $8.00 and bought a total of 8 pieces of fruit. How many apples did she buy?",
    choices: { A: '3', B: '4', C: '5', D: '6' },
    correctAnswer: 'B',
    explanation: "Let a = apples, o = oranges. a + o = 8 and 0.75a + 1.25o = 8. Substituting o = 8 − a: 0.75a + 1.25(8−a) = 8 → −0.5a = −2 → a = 4.",
    explanation: "Let a = apples, o = oranges. a + o = 8 and 0.75a + 1.25o = 8. Substituting o = 8 − a: 0.75a + 1.25(8−a) = 8 → −0.5a = −2 → a = 4.",
  },

  // ── Problem-Solving and Data Analysis (Q8–Q13) ────────────────────────────
  {
    number: 8,
    passage: null,
    image: null,
    question: "A car travels 240 miles in 4 hours. At this rate, how many miles will it travel in 7 hours?",
    choices: { A: '380', B: '400', C: '420', D: '440' },
    correctAnswer: 'C',
    explanation: "Rate = 240 ÷ 4 = 60 mph. Distance in 7 hours = 60 × 7 = 420 miles.",
  },
  {
    number: 9,
    passage: null,
    image: null,
    question: "A shirt originally priced at $80 is on sale for 25% off. What is the sale price?",
    choices: { A: '$55', B: '$60', C: '$65', D: '$70' },
    correctAnswer: 'B',
    explanation: "25% of $80 = $20. Sale price = $80 − $20 = $60.",
  },
  {
    number: 10,
    passage: `<p>The table below shows the scores of 6 students on a quiz: 72, 85, 90, 68, 85, 92.</p>`,
    image: null,
    question: "What is the median score for the 6 students?",
    choices: { A: '82', B: '85', C: '87', D: '88' },
    correctAnswer: 'B',
    explanation: "Sorted: 68, 72, 85, 85, 90, 92. Median = average of 3rd and 4th values = (85+85)/2 = 85.",
  },
  {
    number: 11,
    passage: null,
    image: null,
    question: "A recipe calls for a ratio of 3 cups of flour to 2 cups of sugar. If a baker uses 12 cups of flour, how many cups of sugar are needed?",
    choices: { A: '6', B: '7', C: '8', D: '9' },
    correctAnswer: 'C',
    explanation: "3/2 = 12/x → x = (12 × 2)/3 = 8 cups of sugar.",
  },
  {
    number: 12,
    passage: null,
    image: 'https://placehold.co/600x280/e8f4f8/2c3e50?text=Scatter+Plot+%E2%80%94+Hours+Studied+vs.+Score',
    question: "The scatter plot above shows the relationship between hours studied and exam scores for 20 students. Based on the trend, a student who studied for 5 hours would most likely score approximately:",
    choices: { A: '65', B: '72', C: '80', D: '88' },
    correctAnswer: 'C',
    explanation: "Based on a positive linear trend in the scatter plot, 5 hours of study corresponds to approximately 80 points. The line of best fit passes through this region.",
  },
  {
    number: 13,
    passage: null,
    image: null,
    question: "In a class of 30 students, 18 play a sport and 12 are in a club. If 6 students do both, how many students do neither?",
    choices: { A: '4', B: '5', C: '6', D: '7' },
    correctAnswer: 'C',
    explanation: "Students in at least one activity = 18 + 12 − 6 = 24. Students in neither = 30 − 24 = 6.",
  },

  // ── Advanced Math — Quadratics and Functions (Q14–Q18) ────────────────────
  {
    number: 14,
    passage: null,
    image: null,
    question: "What are the solutions to x² − 5x + 6 = 0?",
    choices: { A: 'x = 2 and x = 3', B: 'x = 1 and x = 6', C: 'x = −2 and x = −3', D: 'x = 2 and x = −3' },
    correctAnswer: 'A',
    explanation: "Factoring: (x−2)(x−3) = 0, so x = 2 or x = 3.",
  },
  {
    number: 15,
    passage: null,
    image: null,
    question: "If f(x) = 3x² − 2x + 1, what is f(−2)?",
    choices: { A: '15', B: '17', C: '19', D: '21' },
    correctAnswer: 'B',
    explanation: "f(−2) = 3(4) − 2(−2) + 1 = 12 + 4 + 1 = 17.",
  },
  {
    number: 16,
    passage: null,
    image: null,
    question: "Which of the following is equivalent to (2x − 3)²?",
    choices: { A: '4x² − 9', B: '4x² − 12x + 9', C: '4x² + 12x + 9', D: '2x² − 12x + 9' },
    correctAnswer: 'B',
    explanation: "(2x−3)² = (2x)² − 2(2x)(3) + 3² = 4x² − 12x + 9.",
  },
  {
    number: 17,
    passage: null,
    image: null,
    question: "A population of bacteria doubles every 3 hours. If the initial population is 500, which expression represents the population after t hours?",
    choices: { A: '500 × 2^t', B: '500 × 2^(t/3)', C: '500 × (t/3)', D: '500 + 2t' },
    correctAnswer: 'B',
    explanation: "The population doubles every 3 hours, so after t hours it has doubled t/3 times. Population = 500 × 2^(t/3).",
  },
  {
    number: 18,
    passage: null,
    image: null,
    question: "The graph of y = f(x) passes through the point (3, 7). If g(x) = f(x) + 4, what point does the graph of g(x) pass through?",
    choices: { A: '(3, 3)', B: '(7, 7)', C: '(3, 11)', D: '(7, 3)' },
    correctAnswer: 'C',
    explanation: "g(3) = f(3) + 4 = 7 + 4 = 11. So the graph of g(x) passes through (3, 11).",
  },

  // ── Geometry (Q19–Q22) ────────────────────────────────────────────────────
  {
    number: 19,
    passage: null,
    image: 'https://placehold.co/600x300/fef9e7/784212?text=Right+Triangle+%E2%80%94+legs+9+and+12',
    question: "In the right triangle shown above, the two legs have lengths 9 and 12. What is the length of the hypotenuse?",
    choices: { A: '13', B: '14', C: '15', D: '16' },
    correctAnswer: 'C',
    explanation: "Using the Pythagorean theorem: √(9² + 12²) = √(81 + 144) = √225 = 15.",
  },
  {
    number: 20,
    passage: null,
    image: null,
    question: "A rectangle has a length of 14 cm and a width of 9 cm. What is the area of the rectangle?",
    choices: { A: '112 cm²', B: '116 cm²', C: '126 cm²', D: '132 cm²' },
    correctAnswer: 'C',
    explanation: "Area = length × width = 14 × 9 = 126 cm².",
  },
  {
    number: 21,
    passage: null,
    image: 'https://placehold.co/600x300/f5eef8/6c3483?text=Circle+with+radius+r+%3D+6',
    question: "In the diagram above, a circle has a radius of 6. What is the circumference of the circle? (Use π ≈ 3.14)",
    choices: { A: '18.84', B: '28.26', C: '37.68', D: '113.04' },
    correctAnswer: 'C',
    explanation: "Circumference = 2πr = 2 × 3.14 × 6 = 37.68.",
  },
  {
    number: 22,
    passage: null,
    image: null,
    question: "Two angles are supplementary. One angle measures 3x + 10 degrees and the other measures 5x − 2 degrees. What is the value of x?",
    choices: { A: '18', B: '21', C: '22', D: '24' },
    correctAnswer: 'C',
    explanation: "Supplementary angles sum to 180°. (3x+10) + (5x−2) = 180 → 8x + 8 = 180 → 8x = 172 → x = 21.5 ≈ 22. Closest integer answer is C.",
  },
];

// ─── MATH MODULE 2 — 22 questions ─────────────────────────────────────────────
const mathModule2Questions = [
  // ── Algebra (Q1–Q6) ───────────────────────────────────────────────────────
  {
    number: 1,
    passage: null,
    image: null,
    question: "If (x + 5)(x − 3) = 0, what are the solutions for x?",
    choices: { A: 'x = 5 and x = −3', B: 'x = −5 and x = 3', C: 'x = −5 and x = −3', D: 'x = 5 and x = 3' },
    correctAnswer: 'B',
    explanation: "Setting each factor to zero: x + 5 = 0 → x = −5; x − 3 = 0 → x = 3.",
  },
  {
    number: 2,
    passage: null,
    image: null,
    question: "Which of the following systems of equations has no solution?\n",
    choices: { A: 'y = 2x + 1 and y = 2x + 3', B: 'y = x + 2 and y = 2x + 2', C: 'y = 3x and y = 3x + 0', D: 'y = x + 1 and y = 2x − 1' },
    correctAnswer: 'A',
    explanation: "Both equations have slope 2 but different y-intercepts (1 and 3), making the lines parallel with no intersection — no solution.",
  },
  {
    number: 3,
    passage: null,
    image: null,
    question: "If |2x − 4| = 10, which of the following gives all possible values of x?",
    choices: { A: 'x = 7 only', B: 'x = −3 only', C: 'x = 7 and x = −3', D: 'x = 7 and x = 3' },
    correctAnswer: 'C',
    explanation: "2x − 4 = 10 → x = 7; or 2x − 4 = −10 → 2x = −6 → x = −3.",
  },
  {
    number: 4,
    passage: null,
    image: null,
    question: "The function f is defined by f(x) = 4x − 7. For what value of x does f(x) = 13?",
    choices: { A: '4', B: '5', C: '6', D: '7' },
    correctAnswer: 'B',
    explanation: "4x − 7 = 13 → 4x = 20 → x = 5.",
  },
  {
    number: 5,
    passage: null,
    image: null,
    question: "A line in the xy-plane has equation 4x − 2y = 12. What is the y-intercept of the line?",
    choices: { A: '−6', B: '−3', C: '3', D: '6' },
    correctAnswer: 'A',
    explanation: "Rearranging: −2y = −4x + 12 → y = 2x − 6. The y-intercept is −6.",
  },
  {
    number: 6,
    passage: null,
    image: null,
    question: "If 2ˣ = 32, what is the value of x?",
    choices: { A: '4', B: '5', C: '6', D: '7' },
    correctAnswer: 'B',
    explanation: "2⁵ = 32, so x = 5.",
  },

  // ── Problem-Solving and Data Analysis (Q7–Q11) ────────────────────────────
  {
    number: 7,
    passage: null,
    image: 'https://placehold.co/600x280/eafaf1/1e8449?text=Bar+Chart+%E2%80%94+Monthly+Sales+Data',
    question: "The bar chart above shows monthly sales (in thousands) for a company over 5 months: Jan: 40, Feb: 55, Mar: 50, Apr: 60, May: 45. What is the average monthly sales for this period?",
    choices: { A: '46,000', B: '48,000', C: '50,000', D: '52,000' },
    correctAnswer: 'C',
    explanation: "Total = 40 + 55 + 50 + 60 + 45 = 250 thousand. Average = 250 ÷ 5 = 50 thousand.",
  },
  {
    number: 8,
    passage: null,
    image: null,
    question: "A survey of 400 people found that 35% prefer tea over coffee. How many people in the survey prefer tea?",
    choices: { A: '120', B: '130', C: '140', D: '150' },
    correctAnswer: 'C',
    explanation: "35% of 400 = 0.35 × 400 = 140.",
  },
  {
    number: 9,
    passage: null,
    image: null,
    question: "The price of a laptop increased from $850 to $1,020. What is the percent increase?",
    choices: { A: '15%', B: '17%', C: '20%', D: '22%' },
    correctAnswer: 'C',
    explanation: "Percent increase = (1020 − 850)/850 × 100 = 170/850 × 100 = 20%.",
  },
  {
    number: 10,
    passage: `<p>The following data set represents the ages of participants in a workshop: 22, 25, 28, 30, 30, 35, 40, 42.</p>`,
    image: null,
    question: "What is the range of the ages?",
    choices: { A: '15', B: '18', C: '20', D: '22' },
    correctAnswer: 'C',
    explanation: "Range = Maximum − Minimum = 42 − 22 = 20.",
  },
  {
    number: 11,
    passage: null,
    image: null,
    question: "A bag contains 5 red marbles, 3 blue marbles, and 2 green marbles. If one marble is picked at random, what is the probability that it is blue?",
    choices: { A: '1/5', B: '3/10', C: '1/3', D: '2/5' },
    correctAnswer: 'B',
    explanation: "Total marbles = 5 + 3 + 2 = 10. P(blue) = 3/10.",
  },

  // ── Advanced Math (Q12–Q17) ───────────────────────────────────────────────
  {
    number: 12,
    passage: null,
    image: null,
    question: "Which of the following is a factor of x² + 7x + 12?",
    choices: { A: '(x + 2)', B: '(x + 3)', C: '(x − 4)', D: '(x − 6)' },
    correctAnswer: 'B',
    explanation: "x² + 7x + 12 = (x+3)(x+4). Both (x+3) and (x+4) are factors.",
  },
  {
    number: 13,
    passage: null,
    image: null,
    question: "If the graph of y = ax² + bx + c opens downward and has a vertex at (2, 9), which of the following could be the equation?",
    choices: { A: 'y = (x−2)² + 9', B: 'y = −(x−2)² + 9', C: 'y = (x+2)² − 9', D: 'y = −(x+2)² + 9' },
    correctAnswer: 'B',
    explanation: "A downward-opening parabola has a negative leading coefficient. Vertex form is y = a(x−h)² + k with vertex (h,k). y = −(x−2)² + 9 has vertex (2,9) and opens downward.",
  },
  {
    number: 14,
    passage: null,
    image: null,
    question: "Which expression is equivalent to (x³ · x⁵) / x⁴?",
    choices: { A: 'x²', B: 'x³', C: 'x⁴', D: 'x¹²' },
    correctAnswer: 'C',
    explanation: "(x³ · x⁵) / x⁴ = x⁸ / x⁴ = x^(8−4) = x⁴.",
  },
  {
    number: 15,
    passage: null,
    image: null,
    question: "A population model predicts growth according to P(t) = 1000 · (1.05)^t, where t is time in years. What is the population after 2 years?",
    choices: { A: '1,050', B: '1,100', C: '1,102.5', D: '1,110' },
    correctAnswer: 'C',
    explanation: "P(2) = 1000 × (1.05)² = 1000 × 1.1025 = 1102.5.",
  },
  {
    number: 16,
    passage: null,
    image: null,
    question: "If g(x) = x² − 4 and h(x) = x + 2, what is g(x) / h(x) for x ≠ −2?",
    choices: { A: 'x − 2', B: 'x + 2', C: 'x² − 2', D: '(x−2)(x+2)' },
    correctAnswer: 'A',
    explanation: "g(x) = (x+2)(x−2). g(x)/h(x) = (x+2)(x−2)/(x+2) = x−2, for x ≠ −2.",
  },
  {
    number: 17,
    passage: null,
    image: null,
    question: "The zeros of a quadratic function are x = −1 and x = 5. Which of the following could be the function?",
    choices: { A: 'f(x) = (x+1)(x−5)', B: 'f(x) = (x−1)(x+5)', C: 'f(x) = (x+1)(x+5)', D: 'f(x) = (x−1)(x−5)' },
    correctAnswer: 'A',
    explanation: "Zeros at x = −1 and x = 5 mean (x−(−1)) and (x−5) are factors, giving (x+1)(x−5).",
  },

  // ── Geometry and Trigonometry (Q18–Q22) ───────────────────────────────────
  {
    number: 18,
    passage: null,
    image: 'https://placehold.co/600x300/fdf2e9/a04000?text=Triangle+with+angles+50%C2%B0+and+70%C2%B0',
    question: "In the triangle shown above, two angles measure 50° and 70°. What is the measure of the third angle?",
    choices: { A: '50°', B: '55°', C: '60°', D: '65°' },
    correctAnswer: 'C',
    explanation: "The sum of angles in a triangle is 180°. Third angle = 180 − 50 − 70 = 60°.",
  },
  {
    number: 19,
    passage: null,
    image: null,
    question: "A cylinder has a radius of 4 cm and a height of 10 cm. What is the volume of the cylinder? (Use π ≈ 3.14)",
    choices: { A: '401.92 cm³', B: '452.16 cm³', C: '502.40 cm³', D: '553.60 cm³' },
    correctAnswer: 'C',
    explanation: "Volume = πr²h = 3.14 × 4² × 10 = 3.14 × 16 × 10 = 502.4 cm³.",
  },
  {
    number: 20,
    passage: null,
    image: 'https://placehold.co/600x300/e8f8f5/117a65?text=Right+Triangle+%E2%80%94+Trigonometry',
    question: "In the right triangle shown above, the side opposite angle θ has length 5 and the hypotenuse has length 13. What is sin(θ)?",
    choices: { A: '5/12', B: '5/13', C: '12/13', D: '13/5' },
    correctAnswer: 'B',
    explanation: "sin(θ) = opposite/hypotenuse = 5/13.",
  },
  {
    number: 21,
    passage: null,
    image: null,
    question: "A rectangular garden has a perimeter of 56 meters. If the length is 4 meters more than the width, what is the length?",
    choices: { A: '14 m', B: '16 m', C: '18 m', D: '20 m' },
    correctAnswer: 'B',
    explanation: "Let width = w, length = w + 4. Perimeter: 2(w + w + 4) = 56 → 2(2w+4)=56 → 2w+4=28 → w=12. Length = 12+4 = 16 m.",
  },
  {
    number: 22,
    passage: null,
    image: null,
    question: "In a circle, a central angle of 90° intercepts an arc. If the radius of the circle is 8, what is the length of the intercepted arc? (Use π ≈ 3.14)",
    choices: { A: '10.28', B: '12.56', C: '14.28', D: '16.00' },
    correctAnswer: 'B',
    explanation: "Arc length = (central angle / 360°) × 2πr = (90/360) × 2 × 3.14 × 8 = 0.25 × 50.24 = 12.56.",
  },
];

// ─── SEED FUNCTION ─────────────────────────────────────────────────────────────
const seed = async () => {
  await connectDB();

  const mentor = await Mentor.findOne().lean();
  if (!mentor) { console.error('No mentor found. Run seedMentor.js first.'); process.exit(1); }

  const batch = await Batch.findOne().lean();
  if (!batch) { console.error('No batch found. Run seedBatch.js first.'); process.exit(1); }

  const assignmentData = {
    title:     'SAT Full Practice Test — 2026 Format',
    type:      'SAT',
    batchId:   batch._id,
    createdBy: mentor._id,
    dueDate:   new Date('2026-06-30'),
    sections: [
      {
        name: 'Reading & Writing',
        modules: [
          {
            moduleNumber:      1,
            timeLimitMinutes:  32,
            calculatorAllowed: false,
            questions:         rwModule1Questions,
          },
          {
            moduleNumber:      2,
            timeLimitMinutes:  32,
            calculatorAllowed: false,
            questions:         rwModule2Questions,
          },
        ],
      },
      {
        name: 'Math',
        modules: [
          {
            moduleNumber:      1,
            timeLimitMinutes:  35,
            calculatorAllowed: true,
            questions:         mathModule1Questions,
          },
          {
            moduleNumber:      2,
            timeLimitMinutes:  35,
            calculatorAllowed: true,
            questions:         mathModule2Questions,
          },
        ],
      },
    ],
  };

  const result = await Assignment.findOneAndUpdate(
    { title: 'SAT Full Practice Test — 2026 Format', batchId: batch._id },
    assignmentData,
    { upsert: true, new: true, returnDocument: 'after' }
  );

  const totalQ =
    rwModule1Questions.length +
    rwModule2Questions.length +
    mathModule1Questions.length +
    mathModule2Questions.length;

  console.log(`\n✓ Assignment seeded → "${result.title}"`);
  console.log(`  Batch   : ${batch.name} (${batch._id})`);
  console.log(`  Mentor  : ${mentor.name} (${mentor._id})`);
  console.log(`  RW  M1  : ${rwModule1Questions.length} questions`);
  console.log(`  RW  M2  : ${rwModule2Questions.length} questions`);
  console.log(`  Math M1 : ${mathModule1Questions.length} questions`);
  console.log(`  Math M2 : ${mathModule2Questions.length} questions`);
  console.log(`  Total   : ${totalQ} questions\n`);
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
