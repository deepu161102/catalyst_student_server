require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const connectDB               = require('./config/db');
const bcrypt                  = require('bcryptjs');
const Student                 = require('./models/Student');
const Mentor                  = require('./models/Mentor');
const Operations              = require('./models/Operations');
const SatQuestionBank         = require('./models/sat/SatQuestionBank');
const SatExamConfig           = require('./models/sat/SatExamConfig');
const SatFullLengthExamConfig = require('./models/sat/SatFullLengthExamConfig');

// ─── Users ────────────────────────────────────────────────────────────���───────

const USERS = {
  ops: {
    email: 'ops@catalyst.com',
    name:  'Priya Menon',
    password: 'mentor123',
  },
  mentor: {
    email: 'mentor@catalyst.com',
    name:  'Arjun Sharma',
    password: 'mentor123',
    specialization: 'SAT Prep',
    experience: 5,
  },
  student: {
    email: 'rahul.sat@example.com',
    name:  'Rahul Verma',
    password: 'student123',
    phone: '9876543210',
    grade: '11',
  },
};

// ─── Math Questions ─────────────────────────���─────────────────────────────────

const MATH_QUESTIONS = [
  // ── Easy (8) ──
  {
    difficulty: 'easy', domain: 'Algebra', topic: 'Linear Equations',
    title: 'Solve for x: 2x + 6 = 14',
    choices: { A: '3', B: '4', C: '5', D: '6' },
    correct_answer: 'B', explanation: '2x = 8, so x = 4',
    explanation_wrong: 'A: 2(3)+6=12≠14. C: 2(5)+6=16≠14. D: 2(6)+6=18≠14.',
  },
  {
    difficulty: 'easy', domain: 'Problem Solving and Data Analysis', topic: 'Percentages',
    title: 'What is 25% of 80?',
    choices: { A: '20', B: '25', C: '40', D: '15' },
    correct_answer: 'A', explanation: '25/100 × 80 = 20',
    explanation_wrong: 'B: 25% of 100 is 25, not of 80. C: That is 50% of 80. D: Incorrect calculation.',
  },
  {
    difficulty: 'easy', domain: 'Algebra', topic: 'Equivalent Expressions',
    title: 'Simplify: 3(x + 4)',
    choices: { A: '3x + 4', B: '3x + 7', C: '3x + 12', D: 'x + 12' },
    correct_answer: 'C', explanation: 'Distribute: 3·x + 3·4 = 3x + 12',
    explanation_wrong: 'A: Only x is multiplied, not 4. B: Addition error. D: 3 is dropped from x term.',
  },
  {
    difficulty: 'easy', domain: 'Algebra', topic: 'Linear Functions',
    title: 'If y = 3x and x = 5, what is y?',
    choices: { A: '8', B: '15', C: '10', D: '35' },
    correct_answer: 'B', explanation: 'y = 3 × 5 = 15',
    explanation_wrong: 'A: 3+5=8, uses addition instead of multiplication. C: 2×5=10. D: Not a standard operation.',
  },
  {
    difficulty: 'easy', domain: 'Algebra', topic: 'Linear Functions',
    title: 'What is the slope of y = 2x + 3?',
    choices: { A: '2', B: '3', C: '5', D: '1' },
    correct_answer: 'A', explanation: 'In y = mx + b, the slope m = 2',
    explanation_wrong: 'B: 3 is the y-intercept, not the slope. C/D: Incorrect readings of the equation.',
  },
  {
    difficulty: 'easy', domain: 'Algebra', topic: 'Linear Equations',
    title: 'Solve for x: x/4 = 6',
    choices: { A: '10', B: '2', C: '24', D: '12' },
    correct_answer: 'C', explanation: 'Multiply both sides by 4: x = 24',
    explanation_wrong: 'A: 4+6=10, wrong operation. B: 6/4≠2. D: 4+8≠24.',
  },
  {
    difficulty: 'easy', domain: 'Geometry and Trigonometry', topic: 'Area and Volume',
    title: 'What is the area of a square with side length 5?',
    choices: { A: '10', B: '25', C: '20', D: '15' },
    correct_answer: 'B', explanation: 'Area = side² = 5² = 25',
    explanation_wrong: 'A: That is the perimeter/2. C: 4×5=20 is perimeter-like. D: Not a standard formula result.',
  },
  {
    difficulty: 'easy', domain: 'Problem Solving and Data Analysis', topic: 'Statistics',
    title: 'Evaluate: 4² − 3²',
    choices: { A: '7', B: '1', C: '25', D: '12' },
    correct_answer: 'A', explanation: '16 − 9 = 7',
    explanation_wrong: 'B: (4−3)²=1, not the same. C: (4+3)²=49≠25. D: 4×3=12, wrong operation.',
  },

  // ── Medium (8) ──
  {
    difficulty: 'medium', domain: 'Advanced Math', topic: 'Nonlinear Equations',
    title: 'Solve: x² − 5x + 6 = 0',
    choices: { A: 'x = 1 or x = 6', B: 'x = 2 or x = 4', C: 'x = −2 or x = −3', D: 'x = 2 or x = 3' },
    correct_answer: 'D', explanation: 'Factor: (x−2)(x−3) = 0, so x = 2 or x = 3',
    explanation_wrong: 'A: 1×6=6 but 1+6≠5. B: 2×4=8≠6. C: Signs are wrong for factoring.',
  },
  {
    difficulty: 'medium', domain: 'Advanced Math', topic: 'Nonlinear Functions',
    title: 'If f(x) = 2x² − 3, what is f(3)?',
    choices: { A: '3', B: '9', C: '15', D: '18' },
    correct_answer: 'C', explanation: 'f(3) = 2(9) − 3 = 18 − 3 = 15',
    explanation_wrong: 'A: 2(3)−3=3, uses x not x². B: 3²=9 but forgot to multiply by 2 and subtract. D: 2(9)=18, forgot to subtract 3.',
  },
  {
    difficulty: 'medium', domain: 'Problem Solving and Data Analysis', topic: 'Rates and Ratios',
    title: 'A car travels at 60 mph for 2.5 hours. How far does it travel?',
    choices: { A: '120 miles', B: '150 miles', C: '140 miles', D: '160 miles' },
    correct_answer: 'B', explanation: 'Distance = speed × time = 60 × 2.5 = 150 miles',
    explanation_wrong: 'A: 60×2=120, forgot the 0.5 hour. C/D: Arithmetic errors.',
  },
  {
    difficulty: 'medium', domain: 'Algebra', topic: 'Systems of Equations',
    title: 'Solve: x + y = 10 and x − y = 4',
    choices: { A: 'x = 7, y = 3', B: 'x = 6, y = 4', C: 'x = 8, y = 2', D: 'x = 5, y = 5' },
    correct_answer: 'A', explanation: 'Add equations: 2x = 14, x = 7. Then y = 10 − 7 = 3',
    explanation_wrong: 'B: 6+4=10 ✓ but 6−4=2≠4. C: 8−2=6≠4. D: 5−5=0≠4.',
  },
  {
    difficulty: 'medium', domain: 'Problem Solving and Data Analysis', topic: 'Statistics',
    title: 'What is the median of {3, 7, 9, 12, 15}?',
    choices: { A: '7', B: '12', C: '9', D: '10' },
    correct_answer: 'C', explanation: 'Median is the middle value of sorted set: 3, 7, 9, 12, 15 → 9',
    explanation_wrong: 'A: 7 is 2nd value, not middle. B: 12 is 4th value. D: 9.2 is the mean, not median.',
  },
  {
    difficulty: 'medium', domain: 'Advanced Math', topic: 'Nonlinear Equations',
    title: 'Factor: x² − 16',
    choices: { A: '(x − 4)²', B: '(x − 4)(x + 4)', C: '(x + 4)²', D: '(x − 2)(x + 8)' },
    correct_answer: 'B', explanation: 'Difference of squares: a² − b² = (a−b)(a+b), so x²−16 = (x−4)(x+4)',
    explanation_wrong: 'A: (x−4)²= x²−8x+16 ≠ x²−16. C: (x+4)²= x²+8x+16. D: (x−2)(x+8)=x²+6x−16.',
  },
  {
    difficulty: 'medium', domain: 'Algebra', topic: 'Linear Equations',
    title: 'If 3x + 2y = 12 and x = 2, what is y?',
    choices: { A: '2', B: '4', C: '6', D: '3' },
    correct_answer: 'D', explanation: '3(2) + 2y = 12 → 6 + 2y = 12 → 2y = 6 → y = 3',
    explanation_wrong: 'A: 3(2)+2(2)=10≠12. B: 3(2)+2(4)=14≠12. C: 3(2)+2(6)=18≠12.',
  },
  {
    difficulty: 'medium', domain: 'Problem Solving and Data Analysis', topic: 'Percentages',
    title: 'A store offers 20% off a $85 item. What is the final price?',
    choices: { A: '$68', B: '$65', C: '$70', D: '$72' },
    correct_answer: 'A', explanation: 'Discount = 20% × 85 = $17. Final = 85 − 17 = $68',
    explanation_wrong: 'B: 85−20=65, subtracts the percentage as dollars. C/D: Arithmetic errors.',
  },

  // ── Hard (8) ──
  {
    difficulty: 'hard', domain: 'Advanced Math', topic: 'Nonlinear Functions',
    title: 'For f(x) = x² − 4x + 3, what are the zeros of f?',
    choices: { A: 'x = 0 and x = 4', B: 'x = −1 and x = −3', C: 'x = 1 and x = 3', D: 'x = 2 and x = 2' },
    correct_answer: 'C', explanation: 'Factor: (x−1)(x−3) = 0, so x = 1 or x = 3',
    explanation_wrong: 'A: f(0)=3≠0. B: Signs wrong. D: (x−2)²=x²−4x+4≠x²−4x+3.',
  },
  {
    difficulty: 'hard', domain: 'Geometry and Trigonometry', topic: 'Right Triangles',
    title: 'A right triangle has legs of length 5 and 12. What is the hypotenuse?',
    choices: { A: '15', B: '13', C: '17', D: '11' },
    correct_answer: 'B', explanation: 'Pythagorean theorem: √(5²+12²) = √(25+144) = √169 = 13',
    explanation_wrong: 'A: 5+12−2=15, incorrect. C: Not a Pythagorean triple. D: Subtraction error.',
  },
  {
    difficulty: 'hard', domain: 'Advanced Math', topic: 'Nonlinear Functions',
    title: 'The function g(x) = (x − 2)² + 3 has its vertex at which point?',
    choices: { A: '(−2, 3)', B: '(2, −3)', C: '(3, 2)', D: '(2, 3)' },
    correct_answer: 'D', explanation: 'Vertex form g(x) = (x−h)² + k has vertex (h, k) = (2, 3)',
    explanation_wrong: 'A: Sign error on h. B: Signs of both swapped. C: h and k values swapped.',
  },
  {
    difficulty: 'hard', domain: 'Geometry and Trigonometry', topic: 'Angles and Polygons',
    title: 'What is the sum of interior angles of a hexagon?',
    choices: { A: '540°', B: '900°', C: '720°', D: '1080°' },
    correct_answer: 'C', explanation: 'Sum = (n−2) × 180 = (6−2) × 180 = 720°',
    explanation_wrong: 'A: (5−2)×180=540°, that is a pentagon. B: (7−2)×180=900°. D: (8−2)×180=1080°.',
  },
  {
    difficulty: 'hard', domain: 'Algebra', topic: 'Linear Equations',
    title: 'Solve: |2x − 6| = 10',
    choices: { A: 'x = 8 or x = −2', B: 'x = 8 or x = 2', C: 'x = 4 or x = −2', D: 'x = 6 or x = −4' },
    correct_answer: 'A', explanation: '2x−6=10 → x=8; 2x−6=−10 → 2x=−4 → x=−2',
    explanation_wrong: 'B: −2 not +2 for the negative case. C: 2(4)−6=2≠10. D: |2(6)−6|=6≠10.',
  },
  {
    difficulty: 'hard', domain: 'Problem Solving and Data Analysis', topic: 'Statistics',
    title: 'The mean of 6 numbers is 14. What is their sum?',
    choices: { A: '20', B: '84', C: '96', D: '70' },
    correct_answer: 'B', explanation: 'Sum = mean × count = 14 × 6 = 84',
    explanation_wrong: 'A: 14+6=20, uses addition. C: 16×6=96. D: 14×5=70, off by one.',
  },
  {
    difficulty: 'hard', domain: 'Advanced Math', topic: 'Nonlinear Functions',
    title: 'For g(x) = 3x² − 12x + 7, what is the minimum value of g?',
    choices: { A: '7', B: '3', C: '0', D: '−5' },
    correct_answer: 'D', explanation: 'Vertex x = −b/2a = 12/6 = 2. g(2) = 3(4)−12(2)+7 = 12−24+7 = −5',
    explanation_wrong: 'A: g(0)=7, the y-intercept, not the minimum. B: 3 is the coefficient. C: Not a valid output.',
  },
  {
    difficulty: 'hard', domain: 'Advanced Math', topic: 'Equivalent Expressions',
    title: 'Which expression is equivalent to (x² − 9)/(x − 3) for x ≠ 3?',
    choices: { A: 'x − 3', B: 'x + 3', C: 'x² + 3', D: '(x − 3)²' },
    correct_answer: 'B', explanation: 'x²−9 = (x−3)(x+3), so dividing by (x−3) gives x+3',
    explanation_wrong: 'A: That would require x²−9=(x−3)². C: Not a factored form. D: (x−3)²≠x²−9.',
  },
];

// ─── Reading & Writing Questions ──────────────────────────────────────────────

const RW_QUESTIONS = [
  // ── Easy (8) ──
  {
    difficulty: 'easy', domain: 'Information and Ideas', topic: 'Central Ideas and Details',
    title: 'Scientists have found that bees can recognize human faces. Researchers trained bees to associate a human face image with a sugary reward. The bees consistently chose the correct face over others in tests. What does the passage primarily suggest about bees?',
    choices: { A: 'Bees prefer sweet foods over other foods', B: 'Bees can be trained to perform complex visual recognition tasks', C: 'Bees have better eyesight than most insects', D: 'Bees naturally recognize human faces without training' },
    correct_answer: 'B', explanation: 'The passage states bees were trained to recognize faces, demonstrating complex visual learning.',
    explanation_wrong: 'A: Sugar is a training tool, not the main point. C: Eyesight quality is not discussed. D: The passage says they were trained, not that it was natural.',
  },
  {
    difficulty: 'easy', domain: 'Information and Ideas', topic: 'Central Ideas and Details',
    title: 'The Amazon rainforest produces about 20% of the world\'s oxygen. It is home to 10% of all species on Earth. Deforestation has destroyed large portions of this ecosystem. According to the passage, which of the following is directly stated?',
    choices: { A: 'The Amazon will disappear within 50 years', B: 'The Amazon contains 10% of all species on Earth', C: 'Deforestation is caused by farming', D: 'The Amazon produces more oxygen than any other forest' },
    correct_answer: 'B', explanation: 'The passage directly states the Amazon is home to 10% of all species on Earth.',
    explanation_wrong: 'A: No timeline is mentioned. C: Causes of deforestation are not specified. D: "About 20%" doesn\'t establish it as the highest producer.',
  },
  {
    difficulty: 'easy', domain: 'Craft and Structure', topic: 'Words in Context',
    title: 'As used in the sentence "The scientist\'s tenacious pursuit of the answer led to a breakthrough," the word "tenacious" most nearly means:',
    choices: { A: 'Careless', B: 'Reluctant', C: 'Persistent', D: 'Rapid' },
    correct_answer: 'C', explanation: '"Tenacious" means persistent or not giving up, which fits a scientist pursuing an answer until breakthrough.',
    explanation_wrong: 'A: Opposite — carefulness leads to breakthroughs. B: Reluctance contradicts a "pursuit." D: Speed is not implied.',
  },
  {
    difficulty: 'easy', domain: 'Information and Ideas', topic: 'Central Ideas and Details',
    title: 'Mount Everest is 8,849 meters tall, making it the highest mountain above sea level. It was first summited in 1953 by Edmund Hillary and Tenzing Norgay. What is the main topic of this passage?',
    choices: { A: 'The dangers of mountain climbing', B: 'Basic facts about Mount Everest', C: 'The career of Edmund Hillary', D: 'How mountains are measured' },
    correct_answer: 'B', explanation: 'The passage presents two key facts about Everest: its height and its first summit.',
    explanation_wrong: 'A: No dangers are described. C: Hillary is mentioned briefly, not as the main focus. D: Measurement methods are not discussed.',
  },
  {
    difficulty: 'easy', domain: 'Craft and Structure', topic: 'Words in Context',
    title: 'The novel\'s "vivid" descriptions of the city made readers feel they were walking its streets. As used here, "vivid" most nearly means:',
    choices: { A: 'Vague', B: 'Dull', C: 'Brief', D: 'Detailed and lifelike' },
    correct_answer: 'D', explanation: '"Vivid" describes something bright, clear, and lifelike — fitting descriptions that make readers feel present.',
    explanation_wrong: 'A/B: Opposites of vivid. C: Brevity is unrelated to the immersive effect described.',
  },
  {
    difficulty: 'easy', domain: 'Information and Ideas', topic: 'Central Ideas and Details',
    title: 'Studies show that students who sleep at least 8 hours perform better on tests than those who sleep fewer hours. Sleep improves memory consolidation. What conclusion is supported by the passage?',
    choices: { A: 'Students should not study before sleep', B: 'Sleep has no effect on memory', C: 'Adequate sleep is linked to better academic performance', D: 'Students need exactly 9 hours of sleep' },
    correct_answer: 'C', explanation: 'The passage directly links 8+ hours of sleep to better test performance and improved memory.',
    explanation_wrong: 'A: Studying before sleep is not discussed. B: Contradicts the passage directly. D: The passage says "at least 8 hours," not exactly 9.',
  },
  {
    difficulty: 'easy', domain: 'Craft and Structure', topic: 'Text Structure and Purpose',
    title: 'A paragraph begins: "First, gather your materials. Then, measure each piece carefully. Finally, assemble the parts." What is the primary purpose of this paragraph?',
    choices: { A: 'To compare two methods', B: 'To argue for a specific approach', C: 'To provide step-by-step instructions', D: 'To describe a historical event' },
    correct_answer: 'C', explanation: 'The sequential signal words (first, then, finally) indicate procedural, step-by-step instructions.',
    explanation_wrong: 'A: No comparison is made. B: No argument or persuasion is present. D: No historical context is given.',
  },
  {
    difficulty: 'easy', domain: 'Expression of Ideas', topic: 'Rhetorical Synthesis',
    title: 'A student is writing about climate change and wants to include a fact that supports action. Which sentence best fits this purpose?',
    choices: { A: 'Some people enjoy warm weather', B: 'Global temperatures have risen 1.1°C since pre-industrial times, accelerating ice melt', C: 'Weather patterns change every decade', D: 'Scientists have different opinions on climate research' },
    correct_answer: 'B', explanation: 'Choice B provides a specific, measurable fact that directly supports the urgency of climate action.',
    explanation_wrong: 'A: Irrelevant to action. C: Vague and doesn\'t support urgency. D: Suggests disagreement rather than supporting action.',
  },

  // ── Medium (8) ──
  {
    difficulty: 'medium', domain: 'Information and Ideas', topic: 'Inferences',
    title: 'Although the company posted record profits, the CEO announced layoffs, citing "restructuring for long-term sustainability." Employees expressed frustration, noting the disconnect between profits and job cuts. What can be inferred about the employees\' view?',
    choices: { A: 'Employees support the CEO\'s long-term vision', B: 'Employees believe profits should have prevented layoffs', C: 'Employees think the company will fail', D: 'Employees are satisfied with their severance packages' },
    correct_answer: 'B', explanation: 'The "disconnect" between profits and layoffs implies employees expected profits to protect jobs.',
    explanation_wrong: 'A: Contradicted by "frustration." C: Not implied — they object to decisions, not predict failure. D: Severance is not mentioned.',
  },
  {
    difficulty: 'medium', domain: 'Craft and Structure', topic: 'Text Structure and Purpose',
    title: 'A researcher writes: "While previous studies claimed X caused Y, our controlled trial found no such relationship. We propose that Z, not X, is the true driver." What is the primary purpose of this passage?',
    choices: { A: 'To confirm previous research findings', B: 'To challenge existing conclusions and present an alternative explanation', C: 'To describe the history of research on Y', D: 'To advocate for more funding for research' },
    correct_answer: 'B', explanation: 'The passage explicitly contradicts prior studies and offers a new causal explanation.',
    explanation_wrong: 'A: The passage contradicts, not confirms. C: History of research is not the focus. D: No funding advocacy is present.',
  },
  {
    difficulty: 'medium', domain: 'Information and Ideas', topic: 'Command of Evidence',
    title: 'A student claims that urban green spaces reduce stress. Which finding would most directly support this claim?',
    choices: { A: 'City parks increase property values nearby', B: 'People who spend 20 minutes in a park show measurably lower cortisol levels', C: 'Urban trees reduce air pollution', D: 'Green spaces attract more tourists to cities' },
    correct_answer: 'B', explanation: 'Lower cortisol directly measures stress reduction, providing the most direct biological evidence.',
    explanation_wrong: 'A: Property values don\'t measure stress. C: Air quality relates indirectly. D: Tourism is unrelated to stress.',
  },
  {
    difficulty: 'medium', domain: 'Craft and Structure', topic: 'Cross-Text Connections',
    title: 'Text 1 argues that social media harms teen mental health. Text 2 states that social media provides vital community for isolated teens. How do the two texts relate?',
    choices: { A: 'Both texts agree social media is harmful', B: 'Text 2 provides evidence that disproves Text 1 entirely', C: 'The texts present contrasting perspectives on social media\'s impact', D: 'Text 1 focuses on adults while Text 2 focuses on teens' },
    correct_answer: 'C', explanation: 'One text argues harm, the other argues benefit — they directly contrast on the same topic.',
    explanation_wrong: 'A: Text 2 presents benefits, not harms. B: One study doesn\'t disprove another entirely. D: Both focus on teens.',
  },
  {
    difficulty: 'medium', domain: 'Expression of Ideas', topic: 'Transitions',
    title: 'Sentence 1: "The experiment produced unexpected results." Sentence 2: "The team decided to redesign their approach." Which transition best connects these sentences?',
    choices: { A: 'Similarly,', B: 'For example,', C: 'In contrast,', D: 'As a result,' },
    correct_answer: 'D', explanation: '"As a result" shows that the unexpected results caused the team to redesign — a cause-effect relationship.',
    explanation_wrong: 'A: "Similarly" shows similarity, not causation. B: "For example" would introduce an illustration. C: "In contrast" would show opposition.',
  },
  {
    difficulty: 'medium', domain: 'Information and Ideas', topic: 'Inferences',
    title: 'The museum\'s attendance doubled after it introduced free admission on Sundays. Membership sales also increased that year. What can most reasonably be inferred?',
    choices: { A: 'The museum lost money due to free admission', B: 'Free admission attracted new visitors who later became paying members', C: 'The museum reduced its collection to cut costs', D: 'Attendance was low before Sunday admission was introduced' },
    correct_answer: 'B', explanation: 'Rising membership alongside higher attendance after free entry suggests free access converted visitors to members.',
    explanation_wrong: 'A: Financial loss is not implied and contradicted by membership growth. C: Not discussed. D: Prior attendance levels are not stated.',
  },
  {
    difficulty: 'medium', domain: 'Craft and Structure', topic: 'Words in Context',
    title: 'The politician\'s "equivocal" statement left voters uncertain about her true position on the bill. As used here, "equivocal" most nearly means:',
    choices: { A: 'Direct and confident', B: 'Deliberately ambiguous', C: 'Emotionally charged', D: 'Legally binding' },
    correct_answer: 'B', explanation: '"Equivocal" means open to multiple interpretations, often intentionally — fitting the result of voter uncertainty.',
    explanation_wrong: 'A: Directness would eliminate uncertainty. C: Emotional charge doesn\'t explain uncertainty. D: Legal status is unrelated.',
  },
  {
    difficulty: 'medium', domain: 'Expression of Ideas', topic: 'Rhetorical Synthesis',
    title: 'A student wants to argue that remote work increases productivity. Which evidence best supports this argument?',
    choices: { A: 'Remote workers report higher job satisfaction in surveys', B: 'A two-year study found remote employees completed 13% more tasks than office employees', C: 'Many companies now offer hybrid work arrangements', D: 'Remote work became common during the 2020 pandemic' },
    correct_answer: 'B', explanation: 'A controlled study with measurable output (tasks completed) directly supports a productivity claim.',
    explanation_wrong: 'A: Satisfaction ≠ productivity. C: Prevalence of hybrid work doesn\'t measure productivity. D: Historical context doesn\'t prove productivity.',
  },

  // ── Hard (8) ──
  {
    difficulty: 'hard', domain: 'Craft and Structure', topic: 'Cross-Text Connections',
    title: 'Text 1: "Wilderness preservation is essential; human development consistently degrades ecosystems." Text 2: "Sustainable development can coexist with conservation when communities control local resources." How would the author of Text 2 likely respond to Text 1?',
    choices: { A: 'By agreeing that development always harms ecosystems', B: 'By arguing that Text 1 oversimplifies the relationship between development and nature', C: 'By suggesting wilderness areas should be expanded', D: 'By claiming conservation is less important than economic growth' },
    correct_answer: 'B', explanation: 'Text 2 offers a nuanced view (sustainable development can coexist with conservation), directly countering Text 1\'s absolute claim.',
    explanation_wrong: 'A: Text 2 contradicts this. C: Text 2 focuses on coexistence, not expansion. D: Text 2 doesn\'t dismiss conservation.',
  },
  {
    difficulty: 'hard', domain: 'Information and Ideas', topic: 'Command of Evidence',
    title: 'A researcher argues that caffeine improves cognitive performance. A critic responds that caffeine only restores performance lost through sleep deprivation. Which finding would most support the critic\'s position?',
    choices: { A: 'Caffeine increases alertness in all subjects tested', B: 'Well-rested subjects show no cognitive improvement after caffeine consumption', C: 'Coffee consumption has risen globally over the past decade', D: 'Caffeine blocks adenosine receptors in the brain' },
    correct_answer: 'B', explanation: 'If caffeine only helps sleep-deprived subjects and not rested ones, it supports the "restoration only" argument.',
    explanation_wrong: 'A: General alertness doesn\'t distinguish restoration from enhancement. C: Consumption trends are irrelevant. D: Mechanism alone doesn\'t resolve the enhancement vs. restoration debate.',
  },
  {
    difficulty: 'hard', domain: 'Craft and Structure', topic: 'Text Structure and Purpose',
    title: 'An author opens with a widely accepted belief, dedicates three paragraphs to counterevidence, then concludes by calling for "a more nuanced framework." The author\'s primary rhetorical strategy is to:',
    choices: { A: 'Confirm the accepted belief with new data', B: 'Undermine a prevailing assumption to argue for a revised understanding', C: 'Present two equally valid opposing viewpoints without taking a position', D: 'Describe a historical debate and its resolution' },
    correct_answer: 'B', explanation: 'The structure — accepted view → counterevidence → call for revision — is a classic strategy to challenge and revise a prevailing assumption.',
    explanation_wrong: 'A: Three paragraphs of counterevidence contradict confirmation. C: The author takes a clear position (new framework). D: No historical narrative is described.',
  },
  {
    difficulty: 'hard', domain: 'Information and Ideas', topic: 'Inferences',
    title: 'Despite extensive marketing, the product\'s sales declined for three consecutive quarters. Internal memos revealed that customer complaints about quality went unaddressed. The CEO publicly attributed the decline to "market conditions." What can be most reasonably inferred about the CEO\'s statement?',
    choices: { A: 'The CEO is unaware of the quality complaints', B: 'The CEO is accurately representing the cause of declining sales', C: 'The CEO may be downplaying internal factors to avoid accountability', D: 'The CEO plans to address quality issues privately' },
    correct_answer: 'C', explanation: 'Internal memos show quality issues existed but were ignored, yet the CEO blamed external factors — suggesting deflection of accountability.',
    explanation_wrong: 'A: Internal memos suggest awareness, not ignorance. B: The text establishes internal factors contradicting the CEO. D: No future plans are mentioned.',
  },
  {
    difficulty: 'hard', domain: 'Expression of Ideas', topic: 'Rhetorical Synthesis',
    title: 'A student argues that universal basic income (UBI) reduces poverty. Which combination of evidence would provide the strongest support?',
    choices: {
      A: 'A philosopher\'s argument that UBI is morally just',
      B: 'A pilot program showing 40% poverty reduction + an economist\'s analysis confirming it scales nationally',
      C: 'Public support polls showing 60% favor UBI',
      D: 'A historical overview of welfare programs since 1960',
    },
    correct_answer: 'B', explanation: 'Empirical data (pilot results) combined with expert analysis of scalability provides both evidence and applicability.',
    explanation_wrong: 'A: Moral arguments don\'t prove effectiveness. C: Popularity doesn\'t prove poverty reduction. D: History provides context, not direct evidence of UBI\'s effect.',
  },
  {
    difficulty: 'hard', domain: 'Craft and Structure', topic: 'Words in Context',
    title: 'The diplomat\'s "pellucid" explanation of the treaty resolved years of ambiguity among negotiators. As used here, "pellucid" most nearly means:',
    choices: { A: 'Controversial', B: 'Lengthy', C: 'Crystal clear', D: 'Politically motivated' },
    correct_answer: 'C', explanation: '"Pellucid" means transparently clear. An explanation that resolves ambiguity must be clear.',
    explanation_wrong: 'A: Controversy would create, not resolve, ambiguity. B: Length doesn\'t resolve ambiguity. D: Motivation is unrelated to clarity.',
  },
  {
    difficulty: 'hard', domain: 'Information and Ideas', topic: 'Central Ideas and Details',
    title: 'Ecologist Dr. Priya Nair found that reintroducing wolves to Yellowstone not only reduced elk populations but also changed elk behavior, causing elk to avoid riverbanks. This allowed vegetation to recover, which stabilized riverbanks and changed the course of rivers. What concept does this passage best illustrate?',
    choices: { A: 'Predator-prey population cycles', B: 'Trophic cascade: how top predators reshape entire ecosystems', C: 'The negative impact of reintroducing species to natural habitats', D: 'River erosion caused by overgrazing' },
    correct_answer: 'B', explanation: 'The passage describes a trophic cascade: wolves → elk behavior change → vegetation recovery → river reshaping.',
    explanation_wrong: 'A: The passage goes beyond population cycles to ecosystem-wide effects. C: The effects described are positive, not negative. D: Erosion context is reversed — vegetation prevents it.',
  },
  {
    difficulty: 'hard', domain: 'Expression of Ideas', topic: 'Transitions',
    title: 'Paragraph 1 concludes: "Traditional classroom instruction remains the dominant model." Paragraph 2 begins: "___ online learning platforms have seen 200% enrollment growth in five years." Which transition is most effective?',
    choices: { A: 'Therefore,', B: 'Similarly,', C: 'Nevertheless,', D: 'As a result,' },
    correct_answer: 'C', explanation: '"Nevertheless" signals that despite traditional instruction\'s dominance, online learning is growing — a concessive contrast.',
    explanation_wrong: 'A: "Therefore" would mean dominance causes growth, which is illogical. B: "Similarly" would suggest both are growing equally. D: "As a result" would imply dominance caused the growth.',
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  await connectDB();
  console.log('Connected to DB\n');

  const hashed = await bcrypt.hash('student123', 10);
  const mentorHashed = await bcrypt.hash('mentor123', 10);

  // Users
  await Operations.findOneAndUpdate(
    { email: USERS.ops.email },
    { name: USERS.ops.name, email: USERS.ops.email, password: mentorHashed },
    { upsert: true, new: true }
  );
  console.log(`✓ Operations: ${USERS.ops.email} / mentor123`);

  await Mentor.findOneAndUpdate(
    { email: USERS.mentor.email },
    { name: USERS.mentor.name, email: USERS.mentor.email, password: mentorHashed, specialization: USERS.mentor.specialization, experience: USERS.mentor.experience },
    { upsert: true, new: true }
  );
  console.log(`✓ Mentor: ${USERS.mentor.email} / mentor123`);

  const student = await Student.findOneAndUpdate(
    { email: USERS.student.email },
    { name: USERS.student.name, email: USERS.student.email, password: hashed, phone: USERS.student.phone, grade: USERS.student.grade, accountType: 'student', isActive: true },
    { upsert: true, new: true }
  );
  console.log(`✓ Student: ${USERS.student.email} / student123`);

  // Map legacy seed question shape → new schema field names
  const toNewShape = (q, subject) => {
    const { title, domain, choices, question_type, explanation_wrong, ...rest } = q;
    return {
      ...rest,
      stem:      title,
      sub_topic: domain,
      topic:     rest.topic || domain,
      option_a:  choices?.A || '',
      option_b:  choices?.B || '',
      option_c:  choices?.C || '',
      option_d:  choices?.D || '',
      format:    'mcq',
      subject,
      is_active: true,
    };
  };

  // Questions — upsert by stem+subject to stay idempotent
  let mathCount = 0;
  let rwCount   = 0;

  for (const q of MATH_QUESTIONS) {
    await SatQuestionBank.findOneAndUpdate(
      { stem: q.title, subject: 'math' },
      toNewShape(q, 'math'),
      { upsert: true, new: true }
    );
    mathCount++;
  }
  console.log(`✓ Math questions seeded: ${mathCount} (${MATH_QUESTIONS.filter(q => q.difficulty==='easy').length}E / ${MATH_QUESTIONS.filter(q => q.difficulty==='medium').length}M / ${MATH_QUESTIONS.filter(q => q.difficulty==='hard').length}H)`);

  for (const q of RW_QUESTIONS) {
    await SatQuestionBank.findOneAndUpdate(
      { stem: q.title, subject: 'reading_writing' },
      toNewShape(q, 'reading_writing'),
      { upsert: true, new: true }
    );
    rwCount++;
  }
  console.log(`✓ R&W questions seeded: ${rwCount} (${RW_QUESTIONS.filter(q => q.difficulty==='easy').length}E / ${RW_QUESTIONS.filter(q => q.difficulty==='medium').length}M / ${RW_QUESTIONS.filter(q => q.difficulty==='hard').length}H)`);

  // ExamConfig — Math
  // Module counts are intentionally small (fits our 8-per-difficulty bank)
  // Module 1: 4q (1E+2M+1H) | M2 Hard: 4q (0E+1M+3H) | M2 Easy: 4q (3E+1M+0H)
  const mathConfig = await SatExamConfig.findOneAndUpdate(
    { name: 'SAT Math - Practice Test 1' },
    {
      name:    'SAT Math - Practice Test 1',
      subject: 'math',
      module_1: {
        total_questions:          4,
        time_limit_minutes:       35,
        difficulty_distribution:  { easy: 1, medium: 2, hard: 1 },
      },
      module_2_hard: {
        total_questions:          4,
        time_limit_minutes:       35,
        difficulty_distribution:  { easy: 0, medium: 1, hard: 3 },
      },
      module_2_easy: {
        total_questions:          4,
        time_limit_minutes:       35,
        difficulty_distribution:  { easy: 3, medium: 1, hard: 0 },
      },
      adaptive_threshold: 60,
      is_active: true,
    },
    { upsert: true, new: true }
  );
  console.log(`✓ ExamConfig: SAT Math - Practice Test 1 (threshold 60%)`);

  // ExamConfig — Reading & Writing
  const rwConfig = await SatExamConfig.findOneAndUpdate(
    { name: 'SAT R&W - Practice Test 1' },
    {
      name:    'SAT R&W - Practice Test 1',
      subject: 'reading_writing',
      module_1: {
        total_questions:          4,
        time_limit_minutes:       32,
        difficulty_distribution:  { easy: 1, medium: 2, hard: 1 },
      },
      module_2_hard: {
        total_questions:          4,
        time_limit_minutes:       32,
        difficulty_distribution:  { easy: 0, medium: 1, hard: 3 },
      },
      module_2_easy: {
        total_questions:          4,
        time_limit_minutes:       32,
        difficulty_distribution:  { easy: 3, medium: 1, hard: 0 },
      },
      adaptive_threshold: 60,
      is_active: true,
    },
    { upsert: true, new: true }
  );
  console.log(`✓ ExamConfig: SAT R&W - Practice Test 1 (threshold 60%)`);

  // FullLengthExamConfig
  await SatFullLengthExamConfig.findOneAndUpdate(
    { name: 'SAT Full Length - Practice Test 1' },
    {
      name:                'SAT Full Length - Practice Test 1',
      math_exam_config_id: mathConfig._id,
      rw_exam_config_id:   rwConfig._id,
      is_active:           true,
    },
    { upsert: true, new: true }
  );
  console.log(`✓ FullLengthExamConfig: SAT Full Length - Practice Test 1`);

  console.log('\n── Ready to test ──────────────��──────────────────────────────────');
  console.log('ops@catalyst.com          / mentor123  →  admin (operations)');
  console.log('mentor@catalyst.com       / mentor123  →  mentor');
  console.log('rahul.sat@example.com     / student123 →  student');
  console.log('\nTest flow:');
  console.log('1. Login as ops → bulk upload or use seeded questions');
  console.log('2. Login as mentor → GET /api/sat/mentor/exam-configs');
  console.log('3. POST /api/sat/mentor/assign  { student_id, test_type: "subject", exam_config_id }');
  console.log('4. Login as student → GET /api/sat/test/assignments');
  console.log('5. POST /api/sat/test/start  { assignment_id }');
  console.log('6. POST /api/sat/test/:sessionId/module/1/submit  { answers: [...] }');
  console.log('7. GET  /api/sat/test/:sessionId/module/2');
  console.log('8. POST /api/sat/test/:sessionId/module/2/submit  { answers: [...] }');
  console.log('9. GET  /api/sat/test/:sessionId/results');

  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
