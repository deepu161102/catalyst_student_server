const SatQuestionBank = require('../models/sat/SatQuestionBank');

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Assembles questions for a module using MongoDB $sample.
// Throws if the bank has insufficient questions for the requested distribution.
const assembleQuestions = async (subject, moduleConfig, excludeIds = []) => {
  const { easy, medium, hard } = moduleConfig.difficulty_distribution;
  const base = { subject, is_active: true };
  if (excludeIds.length) base._id = { $nin: excludeIds };

  const [easyQs, mediumQs, hardQs] = await Promise.all([
    easy   > 0 ? SatQuestionBank.aggregate([{ $match: { ...base, difficulty: 'easy'   } }, { $sample: { size: easy   } }]) : [],
    medium > 0 ? SatQuestionBank.aggregate([{ $match: { ...base, difficulty: 'medium' } }, { $sample: { size: medium } }]) : [],
    hard   > 0 ? SatQuestionBank.aggregate([{ $match: { ...base, difficulty: 'hard'   } }, { $sample: { size: hard   } }]) : [],
  ]);

  if (easyQs.length < easy || mediumQs.length < medium || hardQs.length < hard) {
    throw new Error(
      `Insufficient questions: need ${easy}E/${medium}M/${hard}H, ` +
      `found ${easyQs.length}E/${mediumQs.length}M/${hardQs.length}H for subject "${subject}"`
    );
  }

  return shuffle([...easyQs, ...mediumQs, ...hardQs]);
};

// Strips correct_answer and explanation before sending to student
const stripAnswers = (questions) =>
  questions.map(({ correct_answer, explanation, ...q }) => q);

module.exports = { assembleQuestions, stripAnswers };
