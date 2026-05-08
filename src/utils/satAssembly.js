const SatQuestionBank = require('../models/sat/SatQuestionBank');

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Fetches `count` questions of a given difficulty, preferring unseen ones.
// If the unseen pool is smaller than needed, fills the deficit from seen questions
// (allowing repeats rather than hard-failing). Returns [] if count is 0.
const fetchDifficulty = async (base, difficulty, count, excludeIds) => {
  if (count <= 0) return [];

  const unseenFilter = {
    ...base,
    difficulty,
    ...(excludeIds.length ? { _id: { $nin: excludeIds } } : {}),
  };

  const unseen = await SatQuestionBank.aggregate([
    { $match: unseenFilter },
    { $sample: { size: count } },
  ]);

  if (unseen.length >= count) return unseen;

  // Not enough unseen — fill deficit from the full active pool, excluding what
  // we just picked so we don't duplicate within this call.
  const alreadyPicked = unseen.map((q) => q._id);
  const deficit       = count - unseen.length;

  const fallback = await SatQuestionBank.aggregate([
    { $match: { ...base, difficulty, _id: { $nin: alreadyPicked } } },
    { $sample: { size: deficit } },
  ]);

  return [...unseen, ...fallback];
};

// Assembles questions for a module.
// Prefers questions the student hasn't seen before; falls back to seen ones
// when the unseen pool runs short. Hard-fails only if the total active bank
// (ignoring history) doesn't have enough questions of a given difficulty.
const assembleQuestions = async (subject, moduleConfig, excludeIds = []) => {
  const { easy, medium, hard } = moduleConfig.difficulty_distribution;
  const base = { subject, is_active: true };

  const [easyQs, mediumQs, hardQs] = await Promise.all([
    fetchDifficulty(base, 'easy',   easy,   excludeIds),
    fetchDifficulty(base, 'medium', medium, excludeIds),
    fetchDifficulty(base, 'hard',   hard,   excludeIds),
  ]);

  if (easyQs.length < easy || mediumQs.length < medium || hardQs.length < hard) {
    throw new Error(
      `Insufficient questions: need ${easy}E/${medium}M/${hard}H, ` +
      `found ${easyQs.length}E/${mediumQs.length}M/${hardQs.length}H for subject "${subject}"`
    );
  }

  return shuffle([...easyQs, ...mediumQs, ...hardQs]);
};

// Assembles questions for a practice test filtered by topic + sub_topic.
// Soft-fails: returns however many questions are available if bank is thin.
const assemblePracticeQuestions = async (subject, topic, sub_topic, diffConfig, excludeIds = []) => {
  const { easy, medium, hard } = diffConfig;
  const base = { subject, is_active: true };
  if (topic)     base.topic     = topic;
  if (sub_topic) base.sub_topic = sub_topic;

  const [easyQs, mediumQs, hardQs] = await Promise.all([
    fetchDifficulty(base, 'easy',   easy,   excludeIds),
    fetchDifficulty(base, 'medium', medium, excludeIds),
    fetchDifficulty(base, 'hard',   hard,   excludeIds),
  ]);

  return shuffle([...easyQs, ...mediumQs, ...hardQs]);
};

// Strips correct_answer and explanation before sending to student
const stripAnswers = (questions) =>
  questions.map(({ correct_answer, explanation, ...q }) => q);

module.exports = { assembleQuestions, assemblePracticeQuestions, stripAnswers };
