const { parse }              = require('csv-parse/sync');
const XLSX                   = require('xlsx');
const SatQuestionBank        = require('../../models/sat/SatQuestionBank');
const SatExamConfig          = require('../../models/sat/SatExamConfig');
const SatFullLengthExamConfig = require('../../models/sat/SatFullLengthExamConfig');
const SatBulkImportLog       = require('../../models/sat/SatBulkImportLog');

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const VALID_SUBJECTS     = ['math', 'reading_writing'];
const VALID_MCQ_ANSWERS  = ['A', 'B', 'C', 'D'];

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
      const row    = rows[i];
      const rowNum = i + 2;

      // Support both their column names and our original names
      const title          = (row.question   || row.title)?.trim();
      const rawSubject     = (row.subject)?.trim().toLowerCase();
      const subject        = SUBJECT_MAP[rawSubject] || (VALID_SUBJECTS.includes(rawSubject) ? rawSubject : null);
      const difficulty     = (row.difficulty_level || row.difficulty)?.trim().toLowerCase();
      const domain         = (row.subtopic   || row.domain)?.trim();
      const topic          = (row.skill      || row.topic)?.trim();
      const correct_answer = (row.correct_answer)?.trim().toUpperCase();
      const status         = (row.question_status || '').trim().toLowerCase();

      // Skip unapproved questions when status column is present
      if (row.question_status && status !== 'approved') {
        errors.push({ row_number: rowNum, reason: `skipped — status is "${row.question_status}"` });
        continue;
      }

      if (!title)                                    { errors.push({ row_number: rowNum, reason: 'question/title is required' }); continue; }
      if (!subject)                                  { errors.push({ row_number: rowNum, reason: `unrecognised subject "${row.subject}"` }); continue; }
      if (!VALID_DIFFICULTIES.includes(difficulty))  { errors.push({ row_number: rowNum, reason: `invalid difficulty "${difficulty}"` }); continue; }
      if (!domain)                                   { errors.push({ row_number: rowNum, reason: 'subtopic/domain is required' }); continue; }
      if (!topic)                                    { errors.push({ row_number: rowNum, reason: 'skill/topic is required' }); continue; }
      if (!correct_answer)                           { errors.push({ row_number: rowNum, reason: 'correct_answer is required' }); continue; }
      if (!VALID_MCQ_ANSWERS.includes(correct_answer)) {
        errors.push({ row_number: rowNum, reason: `correct_answer must be A/B/C/D, got "${correct_answer}"` });
        continue;
      }

      // Parse combined options cell OR fall back to individual choice columns
      const choices = row.options
        ? parseOptions(row.options)
        : { A: row.choice_a || '', B: row.choice_b || '', C: row.choice_c || '', D: row.choice_d || '' };

      toInsert.push({
        subject,
        domain,
        topic,
        difficulty,
        title,
        description:       '',
        question_type:     'mcq',
        choices,
        correct_answer,
        explanation:       (row.explanation_correct || row.explanation || '').trim(),
        explanation_wrong: (row.explanation_wrong   || '').trim(),
        hint:              (row.hint                || '').trim(),
        points:            Number(row.points) || 1,
        image_url:         (row.image_url           || '').trim(),
      });
    }

    // Skip exact duplicates already in the bank (same title + subject)
    let successful = 0;
    if (toInsert.length) {
      const existing = await SatQuestionBank.find({
        title:   { $in: toInsert.map((q) => q.title) },
        subject: { $in: [...new Set(toInsert.map((q) => q.subject))] },
      }).select('title subject').lean();

      const existingSet = new Set(existing.map((e) => `${e.title}||${e.subject}`));
      const fresh       = toInsert.filter((q) => !existingSet.has(`${q.title}||${q.subject}`));

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
    const filter = { is_active: true };
    if (req.query.subject)    filter.subject    = req.query.subject;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;
    if (req.query.domain)     filter.domain     = req.query.domain;
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
      { $match: { is_active: true } },
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
  createFullLengthConfig,
  getFullLengthConfigs,
  updateFullLengthConfig,
};
