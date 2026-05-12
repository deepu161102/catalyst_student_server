const { parse }              = require('csv-parse/sync');
const XLSX                   = require('xlsx');
const SatQuestionBank        = require('../../models/sat/SatQuestionBank');
const SatExamConfig          = require('../../models/sat/SatExamConfig');
const SatFullLengthExamConfig = require('../../models/sat/SatFullLengthExamConfig');
const SatPracticeTestConfig  = require('../../models/sat/SatPracticeTestConfig');
const SatBulkImportLog       = require('../../models/sat/SatBulkImportLog');

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const VALID_SUBJECTS     = ['math', 'reading_writing'];
const VALID_MCQ_ANSWERS  = ['A', 'B', 'C', 'D'];
const VALID_FORMATS      = ['mcq', 'grid_in'];

const SUBJECT_MAP = {
  // Math variants
  math: 'math', maths: 'math', mathematics: 'math',
  // Reading & Writing variants
  reading: 'reading_writing', writing: 'reading_writing',
  english: 'reading_writing', 'english language': 'reading_writing',
  'reading and writing': 'reading_writing', 'reading & writing': 'reading_writing',
  'reading/writing': 'reading_writing', rw: 'reading_writing',
  'verbal': 'reading_writing',
};

// Parses "A) text\nB) text\nC) text\nD) text" into { A, B, C, D }
const parseOptions = (raw = '') => {
  const choices = { A: '', B: '', C: '', D: '' };
  const parts   = raw.split(/\n(?=[A-D]\))/);
  for (const part of parts) {
    const m = part.match(/^([A-D])\)\s*([\s\S]*)/);
    if (m) choices[m[1]] = m[2].trim();
  }
  return choices;
};

// ── POST /api/sat/admin/question-bank/bulk-upload ─────────────────────────────
const bulkUpload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV or Excel file is required' });

    let rows;
    const isXlsx = req.file.originalname.match(/\.xlsx?$/i);
    if (isXlsx) {
      const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet     = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      // Support both TSV and CSV — detect delimiter from first line
      const firstLine = req.file.buffer.toString('utf8').split('\n')[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';
      rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true, delimiter });
    }

    const toInsert = [];
    const errors   = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;

      // Normalize all header keys to lowercase so uploads are case-insensitive
      const row = Object.fromEntries(Object.entries(rows[i]).map(([k, v]) => [k.toLowerCase(), v]));

      const stem           = (row.stem || row.question || row.title)?.trim();
      const rawSubject     = row.subject?.trim().toLowerCase();
      const subject        = SUBJECT_MAP[rawSubject] || (VALID_SUBJECTS.includes(rawSubject) ? rawSubject : null);
      const difficulty     = (row.difficulty || row.difficulty_level)?.trim().toLowerCase();
      const sub_topic      = (row.sub_topic || row.subtopic || row.domain)?.trim();
      const topic          = (row.topic)?.trim();
      const skill_tag      = (row.skill_tag || row.skill || '').trim();
      const rawFormat      = (row.format || row.question_type || 'mcq').trim().toLowerCase();
      const format         = VALID_FORMATS.includes(rawFormat) ? rawFormat : 'mcq';
      const rawStatus      = (row.review_status || row.question_status || '').trim().toLowerCase();

      // correct_answer: uppercase only for MCQ (A/B/C/D); keep as-is for grid_in
      const rawAnswer      = row.correct_answer?.trim();
      const correct_answer = format === 'mcq' ? rawAnswer?.toUpperCase() : rawAnswer;

      // Skip unapproved questions when any status column is present
      const hasStatus = row.review_status !== undefined || row.question_status !== undefined;
      if (hasStatus && rawStatus !== 'approved') {
        errors.push({ row_number: rowNum, reason: `skipped — status is "${rawStatus}"` });
        continue;
      }

      if (!stem)                                     { errors.push({ row_number: rowNum, reason: 'stem/question is required' }); continue; }
      if (!subject)                                  { errors.push({ row_number: rowNum, reason: `unrecognised subject "${row.subject}"` }); continue; }
      if (!VALID_DIFFICULTIES.includes(difficulty))  { errors.push({ row_number: rowNum, reason: `invalid difficulty "${difficulty}"` }); continue; }
      if (!sub_topic)                                { errors.push({ row_number: rowNum, reason: 'sub_topic is required' }); continue; }
      if (!topic)                                    { errors.push({ row_number: rowNum, reason: 'topic is required' }); continue; }
      if (format === 'mcq' && correct_answer && !VALID_MCQ_ANSWERS.includes(correct_answer)) {
        errors.push({ row_number: rowNum, reason: `correct_answer must be A/B/C/D for mcq, got "${correct_answer}"` });
        continue;
      }

      // Options: flat option_a/b/c/d (CB format) — optional for grid_in
      const parsedOptions = row.options ? parseOptions(row.options) : null;
      const option_a = (parsedOptions?.A || row.option_a || row.choice_a || '').trim();
      const option_b = (parsedOptions?.B || row.option_b || row.choice_b || '').trim();
      const option_c = (parsedOptions?.C || row.option_c || row.choice_c || '').trim();
      const option_d = (parsedOptions?.D || row.option_d || row.choice_d || '').trim();

      // isCalculatorAllowed — optional, defaults to false
      const rawCalc = row.iscalculatorallowed;
      const is_calculator_allowed = rawCalc !== undefined && String(rawCalc).trim() !== ''
        ? String(rawCalc).trim().toLowerCase() === 'true'
        : false;

      toInsert.push({
        question_id:    (row.question_id || '').trim(),
        cb_question_id: (row.cb_question_id || '').trim(),
        cb_external_id: (row.cb_external_id || '').trim(),
        cb_ibn:         (row.cb_ibn || '').trim(),
        course:         (row.course || 'sat').trim(),
        subject,
        topic,
        sub_topic,
        skill_tag,
        difficulty,
        format,
        passage_id:     row.passage_id?.trim() || null,
        stem,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation:    (row.explanation || row.explanation_correct || '').trim(),
        hint_1:         (row.hint_1 || '').trim(),
        hint_2:         (row.hint_2 || '').trim(),
        hint_3:         (row.hint_3 || '').trim(),
        review_status:  rawStatus || 'approved',
        source:         (row.source || '').trim(),
        points:         Number(row.points) || 1,
        is_calculator_allowed,
      });
    }

    // Dedup: prefer question_id match when present, else fall back to stem+subject
    let successful = 0;
    if (toInsert.length) {
      const withId    = toInsert.filter((q) => q.question_id);
      const withoutId = toInsert.filter((q) => !q.question_id);

      const existingIds = withId.length
        ? await SatQuestionBank.find({ question_id: { $in: withId.map((q) => q.question_id) } })
            .select('question_id').lean()
        : [];
      const existingIdSet = new Set(existingIds.map((e) => e.question_id));

      const existingStems = withoutId.length
        ? await SatQuestionBank.find({
            stem:    { $in: withoutId.map((q) => q.stem) },
            subject: { $in: [...new Set(withoutId.map((q) => q.subject))] },
          }).select('stem subject').lean()
        : [];
      const existingStemSet = new Set(existingStems.map((e) => `${e.stem}||${e.subject}`));

      const fresh = [
        ...withId.filter((q) => !existingIdSet.has(q.question_id)),
        ...withoutId.filter((q) => !existingStemSet.has(`${q.stem}||${q.subject}`)),
      ];

      if (fresh.length) {
        await SatQuestionBank.insertMany(fresh, { ordered: false });
        successful = fresh.length;
      }
    }

    const log = await SatBulkImportLog.create({
      uploaded_by: req.userId,
      file_name:   req.file.originalname,
      subject:     rows[0]?.subject || 'mixed',
      total_rows:  rows.length,
      successful,
      failed:      errors.length + (toInsert.length - successful),
      row_errors:  errors,
    });

    res.status(201).json({
      success: true,
      data: {
        total_rows:  rows.length,
        successful,
        failed:      log.failed,
        import_log:  log._id,
        row_errors:  errors,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/admin/question-bank ─────────────────────────────────────────
const getQuestions = async (req, res) => {
  try {
    const filter = { is_active: { $ne: false } };
    if (req.query.subject)    filter.subject    = req.query.subject;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;
    if (req.query.sub_topic)  filter.sub_topic  = req.query.sub_topic;
    if (req.query.topic)      filter.topic      = req.query.topic;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      SatQuestionBank.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SatQuestionBank.countDocuments(filter),
    ]);

    res.json({ success: true, total, page, limit, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PUT /api/sat/admin/question-bank/:id ─────────────────────────────────────
const updateQuestion = async (req, res) => {
  try {
    const question = await SatQuestionBank.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!question) return res.status(404).json({ success: false, message: 'Question not found' });
    res.json({ success: true, data: question });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/sat/admin/question-bank/:id ───────────────────────────────────
const deleteQuestion = async (req, res) => {
  try {
    const question = await SatQuestionBank.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );
    if (!question) return res.status(404).json({ success: false, message: 'Question not found' });
    res.json({ success: true, message: 'Question deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/admin/question-bank/stats ────────────────────────────────────
const getQuestionStats = async (req, res) => {
  try {
    const stats = await SatQuestionBank.aggregate([
      { $match: { is_active: { $ne: false } } },
      {
        $group: {
          _id:   { subject: '$subject', difficulty: '$difficulty' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.subject': 1, '_id.difficulty': 1 } },
    ]);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── ExamConfig ────────────────────────────────────────────────────────────────

// POST /api/sat/admin/exam-configs
const createExamConfig = async (req, res) => {
  try {
    const config = await SatExamConfig.create(req.body);
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/sat/admin/exam-configs
const getExamConfigs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.active !== undefined) filter.is_active = req.query.active !== 'false';

    const configs = await SatExamConfig.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: configs.length, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sat/admin/exam-configs/:id
const getExamConfigById = async (req, res) => {
  try {
    const config = await SatExamConfig.findById(req.params.id).lean();
    if (!config) return res.status(404).json({ success: false, message: 'Exam config not found' });
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/sat/admin/exam-configs/:id
const updateExamConfig = async (req, res) => {
  try {
    const config = await SatExamConfig.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!config) return res.status(404).json({ success: false, message: 'Exam config not found' });
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/sat/admin/exam-configs/pair-demo-access
// Updates is_demo_accessible on both configs of a pair atomically.
// Body: { mathConfigId?, rwConfigId?, is_demo_accessible: boolean }
const patchPairDemoAccess = async (req, res) => {
  try {
    const { mathConfigId, rwConfigId, is_demo_accessible } = req.body;
    if (typeof is_demo_accessible !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_demo_accessible must be a boolean' });
    }
    const ids = [mathConfigId, rwConfigId].filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one config ID is required' });
    }
    await SatExamConfig.updateMany(
      { _id: { $in: ids } },
      { $set: { is_demo_accessible } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── FullLengthExamConfig ──────────────────────────────────────────────────────

// POST /api/sat/admin/full-length-configs
const createFullLengthConfig = async (req, res) => {
  try {
    const [mathConfig, rwConfig] = await Promise.all([
      SatExamConfig.findById(req.body.math_exam_config_id),
      SatExamConfig.findById(req.body.rw_exam_config_id),
    ]);
    if (!mathConfig) return res.status(400).json({ success: false, message: 'Math exam config not found' });
    if (!rwConfig)   return res.status(400).json({ success: false, message: 'R&W exam config not found' });
    if (mathConfig.subject !== 'math')             return res.status(400).json({ success: false, message: 'math_exam_config_id must be a math config' });
    if (rwConfig.subject   !== 'reading_writing')  return res.status(400).json({ success: false, message: 'rw_exam_config_id must be a reading_writing config' });

    const config = await SatFullLengthExamConfig.create(req.body);
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/sat/admin/full-length-configs
const getFullLengthConfigs = async (req, res) => {
  try {
    const configs = await SatFullLengthExamConfig.find()
      .populate('math_exam_config_id', 'name subject')
      .populate('rw_exam_config_id',   'name subject')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, count: configs.length, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/sat/admin/full-length-configs/:id
const updateFullLengthConfig = async (req, res) => {
  try {
    const config = await SatFullLengthExamConfig.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!config) return res.status(404).json({ success: false, message: 'Full length config not found' });
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── PracticeTestConfig ────────────────────────────────────────────────────────

// POST /api/sat/admin/practice-configs
const createPracticeConfig = async (req, res) => {
  try {
    const config = await SatPracticeTestConfig.create(req.body);
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/sat/admin/practice-configs
const getPracticeConfigs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.topic)     filter.topic     = req.query.topic;
    if (req.query.sub_topic) filter.sub_topic = req.query.sub_topic;
    if (req.query.active !== undefined) filter.is_active = req.query.active !== 'false';

    const configs = await SatPracticeTestConfig.find(filter).sort({ display_order: 1, createdAt: -1 }).lean();
    res.json({ success: true, count: configs.length, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/sat/admin/practice-configs/:id
const updatePracticeConfig = async (req, res) => {
  try {
    const config = await SatPracticeTestConfig.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!config) return res.status(404).json({ success: false, message: 'Practice config not found' });
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  bulkUpload,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  getQuestionStats,
  createExamConfig,
  getExamConfigs,
  getExamConfigById,
  updateExamConfig,
  patchPairDemoAccess,
  createFullLengthConfig,
  getFullLengthConfigs,
  updateFullLengthConfig,
  createPracticeConfig,
  getPracticeConfigs,
  updatePracticeConfig,
};
