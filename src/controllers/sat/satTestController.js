const SatTestSession            = require('../../models/sat/SatTestSession');
const SatFullLengthSession      = require('../../models/sat/SatFullLengthSession');
const SatExamConfig             = require('../../models/sat/SatExamConfig');
const SatFullLengthExamConfig   = require('../../models/sat/SatFullLengthExamConfig');
const SatPracticeTestConfig     = require('../../models/sat/SatPracticeTestConfig');
const SatPracticeSession        = require('../../models/sat/SatPracticeSession');
const SatAssignment             = require('../../models/sat/SatAssignment');
const SatQuestionBank           = require('../../models/sat/SatQuestionBank');
const SatStudentQuestionHistory = require('../../models/sat/SatStudentQuestionHistory');
const { assembleQuestions, assemblePracticeQuestions, stripAnswers } = require('../../utils/satAssembly');

// Appends question IDs to the student's seen history for a subject
const recordSeenQuestions = async (studentId, subject, questionIds) => {
  await SatStudentQuestionHistory.findOneAndUpdate(
    { student_id: studentId, subject },
    { $addToSet: { seen_question_ids: { $each: questionIds } } },
    { upsert: true, new: true }
  );
};

// ── POST /api/sat/test/start ──────────────────────────────────────────────────
// ── GET /api/sat/test/configs ─────────────────────────────────────────────────
// Returns all active mock/diagnostic exam configs for student self-serve browsing
const listExamConfigs = async (req, res) => {
  try {
    const configs = await SatExamConfig.find({ is_active: true })
      .select('name subject type adaptive_threshold module_1')
      .sort({ subject: 1, type: 1, name: 1 })
      .lean();
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/test/start ──────────────────────────────────────────────────
// Body: { assignment_id } OR { exam_config_id }
const startSession = async (req, res) => {
  try {
    const { assignment_id, exam_config_id: directConfigId } = req.body;
    if (!assignment_id && !directConfigId) {
      return res.status(400).json({ success: false, message: 'assignment_id or exam_config_id is required' });
    }

    let examConfig;
    let assignmentDoc = null;

    if (assignment_id) {
      // Assignment-based flow (legacy — kept for backward compat)
      assignmentDoc = await SatAssignment.findOne({
        _id:        assignment_id,
        student_id: req.userId,
        is_active:  true,
      });
      if (!assignmentDoc) return res.status(404).json({ success: false, message: 'Assignment not found' });
      if (assignmentDoc.status === 'completed') return res.status(400).json({ success: false, message: 'Assignment already completed' });

      if (assignmentDoc.test_type === 'full_length') {
        return startFullLengthSession(req, res, assignmentDoc);
      }

      // Resume existing in-progress session
      if (assignmentDoc.status === 'in_progress' && assignmentDoc.session_id) {
        const existing = await SatTestSession.findById(assignmentDoc.session_id).lean();
        if (existing) {
          const questions = await SatQuestionBank.find({ _id: { $in: existing.module_1.question_ids } }).lean();
          const cfg = await SatExamConfig.findById(existing.exam_config_id).lean();
          return res.json({
            success:    true,
            resumed:    true,
            session_id: existing._id,
            status:     existing.status,
            subject:    existing.subject,
            module_1: {
              questions:          stripAnswers(questions),
              time_limit_minutes: cfg.module_1.time_limit_minutes,
              started_at:         existing.module_1.started_at,
            },
          });
        }
      }

      examConfig = await SatExamConfig.findById(assignmentDoc.exam_config_id);
    } else {
      // Direct / self-serve flow — no assignment required
      examConfig = await SatExamConfig.findById(directConfigId);
    }

    if (!examConfig || !examConfig.is_active) {
      return res.status(404).json({ success: false, message: 'Exam config not found' });
    }

    // Get student's question history to avoid repeats
    const history = await SatStudentQuestionHistory.findOne({
      student_id: req.userId,
      subject:    examConfig.subject,
    }).lean();
    const seenIds = history?.seen_question_ids || [];

    // Assemble M1 and pre-fetch all M2 tiers in parallel
    const m1Questions  = await assembleQuestions(examConfig.subject, examConfig.module_1, seenIds);
    const m1Ids        = m1Questions.map((q) => q._id);
    const excludeForM2 = [...seenIds, ...m1Ids];

    const prefetchJobs = [
      assembleQuestions(examConfig.subject, examConfig.module_2_hard, excludeForM2),
      examConfig.module_2_medium
        ? assembleQuestions(examConfig.subject, examConfig.module_2_medium, excludeForM2)
        : Promise.resolve([]),
      assembleQuestions(examConfig.subject, examConfig.module_2_easy, excludeForM2),
    ];

    const [prefetchHard, prefetchMedium, prefetchEasy] = await Promise.allSettled(prefetchJobs);

    const session = await SatTestSession.create({
      student_id:     req.userId,
      exam_config_id: examConfig._id,
      assignment_id:  assignmentDoc?._id,
      subject:        examConfig.subject,
      status:         'm1_in_progress',
      module_1: {
        question_ids: m1Ids,
        started_at:   new Date(),
      },
      prefetched: {
        hard:   prefetchHard.status   === 'fulfilled' ? prefetchHard.value.map((q)   => q._id) : [],
        medium: prefetchMedium.status === 'fulfilled' ? prefetchMedium.value.map((q) => q._id) : [],
        easy:   prefetchEasy.status   === 'fulfilled' ? prefetchEasy.value.map((q)   => q._id) : [],
      },
    });

    if (assignmentDoc) {
      await SatAssignment.findByIdAndUpdate(assignmentDoc._id, {
        status:     'in_progress',
        session_id: session._id,
      });
    }

    res.status(201).json({
      success:    true,
      session_id: session._id,
      status:     session.status,
      subject:    examConfig.subject,
      module_1: {
        questions:          stripAnswers(m1Questions),
        time_limit_minutes: examConfig.module_1.time_limit_minutes,
        started_at:         session.module_1.started_at,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Internal helper for full-length session start
const startFullLengthSession = async (req, res, assignment) => {
  const flConfig = await SatFullLengthExamConfig.findById(assignment.full_length_exam_config_id)
    .populate('math_exam_config_id')
    .populate('rw_exam_config_id');
  if (!flConfig) return res.status(404).json({ success: false, message: 'Full length config not found' });

  const mathConfig = flConfig.math_exam_config_id;
  const rwConfig   = flConfig.rw_exam_config_id;

  const [mathHistory, rwHistory] = await Promise.all([
    SatStudentQuestionHistory.findOne({ student_id: req.userId, subject: 'math' }).lean(),
    SatStudentQuestionHistory.findOne({ student_id: req.userId, subject: 'reading_writing' }).lean(),
  ]);

  const mathSeenIds = mathHistory?.seen_question_ids || [];
  const rwSeenIds   = rwHistory?.seen_question_ids   || [];

  const [mathM1Questions, rwM1Questions] = await Promise.all([
    assembleQuestions('math', mathConfig.module_1, mathSeenIds),
    assembleQuestions('reading_writing', rwConfig.module_1, rwSeenIds),
  ]);

  const mathM1Ids      = mathM1Questions.map((q) => q._id);
  const rwM1Ids        = rwM1Questions.map((q) => q._id);
  const mathExcludeM2  = [...mathSeenIds, ...mathM1Ids];
  const rwExcludeM2    = [...rwSeenIds, ...rwM1Ids];

  const [mathPrefetch, rwPrefetch] = await Promise.all([
    Promise.allSettled([
      assembleQuestions('math', mathConfig.module_2_hard, mathExcludeM2),
      assembleQuestions('math', mathConfig.module_2_easy, mathExcludeM2),
    ]),
    Promise.allSettled([
      assembleQuestions('reading_writing', rwConfig.module_2_hard, rwExcludeM2),
      assembleQuestions('reading_writing', rwConfig.module_2_easy, rwExcludeM2),
    ]),
  ]);

  const now = new Date();

  const [mathSession, rwSession] = await Promise.all([
    SatTestSession.create({
      student_id: req.userId, exam_config_id: mathConfig._id,
      assignment_id: assignment._id, subject: 'math', status: 'm1_in_progress',
      module_1: { question_ids: mathM1Ids, started_at: now },
      prefetched: {
        hard: mathPrefetch[0].status === 'fulfilled' ? mathPrefetch[0].value.map((q) => q._id) : [],
        easy: mathPrefetch[1].status === 'fulfilled' ? mathPrefetch[1].value.map((q) => q._id) : [],
      },
    }),
    SatTestSession.create({
      student_id: req.userId, exam_config_id: rwConfig._id,
      assignment_id: assignment._id, subject: 'reading_writing', status: 'm1_in_progress',
      module_1: { question_ids: rwM1Ids, started_at: now },
      prefetched: {
        hard: rwPrefetch[0].status === 'fulfilled' ? rwPrefetch[0].value.map((q) => q._id) : [],
        easy: rwPrefetch[1].status === 'fulfilled' ? rwPrefetch[1].value.map((q) => q._id) : [],
      },
    }),
  ]);

  const flSession = await SatFullLengthSession.create({
    student_id:                 req.userId,
    full_length_exam_config_id: flConfig._id,
    assignment_id:              assignment._id,
    math_session_id:            mathSession._id,
    rw_session_id:              rwSession._id,
  });

  await Promise.all([
    SatTestSession.findByIdAndUpdate(mathSession._id, { full_length_session_id: flSession._id }),
    SatTestSession.findByIdAndUpdate(rwSession._id,   { full_length_session_id: flSession._id }),
    SatAssignment.findByIdAndUpdate(assignment._id, { status: 'in_progress', session_id: flSession._id }),
  ]);

  res.status(201).json({
    success:              true,
    full_length_session_id: flSession._id,
    math_session_id:      mathSession._id,
    rw_session_id:        rwSession._id,
    math: {
      questions:          stripAnswers(mathM1Questions),
      time_limit_minutes: mathConfig.module_1.time_limit_minutes,
      started_at:         now,
    },
    rw: {
      questions:          stripAnswers(rwM1Questions),
      time_limit_minutes: rwConfig.module_1.time_limit_minutes,
      started_at:         now,
    },
  });
};

// ── POST /api/sat/test/:sessionId/module/1/submit ─────────────────────────────
// Body: { answers: [{ question_id, selected }] }
const submitModule1 = async (req, res) => {
  try {
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'm1_in_progress',
    });
    if (!session) return res.status(404).json({ success: false, message: 'Active Module 1 session not found' });

    const { answers = [] } = req.body;
    const examConfig = await SatExamConfig.findById(session.exam_config_id).lean();

    // Fetch questions to grade
    const questions = await SatQuestionBank.find({ _id: { $in: session.module_1.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map((q) => [q._id.toString(), q]));

    let score = 0;
    const gradedAnswers = session.module_1.question_ids.map((qId) => {
      const q        = questionMap[qId.toString()];
      const answer   = answers.find((a) => a.question_id?.toString() === qId.toString());
      const selected  = answer?.selected?.trim() || null;
      const correct   = q?.correct_answer?.trim();
      const isCorrect = selected !== null && selected.toLowerCase() === correct?.toLowerCase();
      const pts       = isCorrect ? (q?.points || 1) : 0;
      score += pts;
      return { question_id: qId, selected, is_correct: isCorrect, points_earned: pts };
    });

    const maxScore  = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    // Determine adaptive tier using dual thresholds
    let tier;
    if (percentage >= examConfig.adaptive_threshold) {
      tier = 'hard';
    } else if (percentage >= (examConfig.adaptive_threshold_medium ?? 40) && examConfig.module_2_medium) {
      tier = 'medium';
    } else {
      tier = 'easy';
    }

    // Validate prefetched set for the chosen tier exists
    const prefetchedIds = session.prefetched[tier];
    if (!prefetchedIds?.length) {
      return res.status(500).json({ success: false, message: `Prefetched questions for ${tier} tier are unavailable. Contact admin.` });
    }

    const now = new Date();

    await SatTestSession.findByIdAndUpdate(session._id, {
      status: 'm1_complete',
      'module_1.answers':      gradedAnswers,
      'module_1.score':        score,
      'module_1.max_score':    maxScore,
      'module_1.percentage':   percentage,
      'module_1.submitted_at': now,
      'module_2.tier':         tier,
      'module_2.question_ids': prefetchedIds,
    });

    // Append M1 questions to student history
    await recordSeenQuestions(req.userId, session.subject, session.module_1.question_ids);

    // Per-question breakdown with correct answers revealed
    const breakdown = gradedAnswers.map((a) => {
      const q = questionMap[a.question_id.toString()];
      return {
        question_id:    a.question_id,
        stem:           q?.stem,
        selected:       a.selected,
        correct_answer: q?.correct_answer,
        is_correct:     a.is_correct,
        explanation:    q?.explanation,
        topic:          q?.topic,
        difficulty:     q?.difficulty,
      };
    });

    res.json({
      success: true,
      module_1: { score, max_score: maxScore, percentage, submitted_at: now },
      adaptive: { tier, threshold: examConfig.adaptive_threshold },
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/test/:sessionId/module/2 ─────────────────────────────────────
const getModule2 = async (req, res) => {
  try {
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     { $in: ['m1_complete', 'm2_in_progress'] },
    });
    if (!session) return res.status(404).json({ success: false, message: 'Session not ready for Module 2' });

    const examConfig = await SatExamConfig.findById(session.exam_config_id).lean();
    const m2Config   = session.module_2.tier === 'hard' ? examConfig.module_2_hard : examConfig.module_2_easy;

    const questions = await SatQuestionBank.find({ _id: { $in: session.module_2.question_ids } }).lean();

    if (session.status === 'm1_complete') {
      await SatTestSession.findByIdAndUpdate(session._id, {
        status:                 'm2_in_progress',
        'module_2.started_at': new Date(),
      });
    }

    res.json({
      success: true,
      session_id: session._id,
      module_2: {
        tier:               session.module_2.tier,
        questions:          stripAnswers(questions),
        time_limit_minutes: m2Config.time_limit_minutes,
        started_at:         session.module_2.started_at || new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/test/:sessionId/module/2/submit ─────────────────────────────
// Body: { answers: [{ question_id, selected }] }
const submitModule2 = async (req, res) => {
  try {
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'm2_in_progress',
    });
    if (!session) return res.status(404).json({ success: false, message: 'Active Module 2 session not found' });

    const { answers = [] } = req.body;

    const questions  = await SatQuestionBank.find({ _id: { $in: session.module_2.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map((q) => [q._id.toString(), q]));

    let score = 0;
    const gradedAnswers = session.module_2.question_ids.map((qId) => {
      const q        = questionMap[qId.toString()];
      const answer   = answers.find((a) => a.question_id?.toString() === qId.toString());
      const selected  = answer?.selected?.trim() || null;
      const correct   = q?.correct_answer?.trim();
      const isCorrect = selected !== null && selected.toLowerCase() === correct?.toLowerCase();
      const pts       = isCorrect ? (q?.points || 1) : 0;
      score += pts;
      return { question_id: qId, selected, is_correct: isCorrect, points_earned: pts };
    });

    const maxScore   = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const now        = new Date();

    // Reload M1 data for total
    const updated = await SatTestSession.findByIdAndUpdate(
      session._id,
      {
        status:                  'complete',
        'module_2.answers':      gradedAnswers,
        'module_2.score':        score,
        'module_2.max_score':    maxScore,
        'module_2.percentage':   percentage,
        'module_2.submitted_at': now,
        total_score:             (session.module_1.score || 0) + score,
      },
      { new: true }
    );

    // Append M2 questions to student history
    await recordSeenQuestions(req.userId, session.subject, session.module_2.question_ids);

    // Update assignment status
    await SatAssignment.findByIdAndUpdate(session.assignment_id, { status: 'completed' });

    // If part of a full length session, check if both subjects are complete
    if (session.full_length_session_id) {
      const flSession = await SatFullLengthSession.findById(session.full_length_session_id);
      if (flSession) {
        const mathSession = await SatTestSession.findById(flSession.math_session_id).lean();
        const rwSession   = await SatTestSession.findById(flSession.rw_session_id).lean();
        const bothDone    = mathSession?.status === 'complete' && rwSession?.status === 'complete';
        if (bothDone) {
          const totalScore = (mathSession.total_score || 0) + (rwSession.total_score || 0);
          await SatFullLengthSession.findByIdAndUpdate(session.full_length_session_id, {
            status: 'complete',
            total_score: totalScore,
          });
        }
      }
    }

    const breakdown = gradedAnswers.map((a) => {
      const q = questionMap[a.question_id.toString()];
      return {
        question_id:    a.question_id,
        stem:           q?.stem,
        selected:       a.selected,
        correct_answer: q?.correct_answer,
        is_correct:     a.is_correct,
        explanation:    q?.explanation,
        topic:          q?.topic,
        difficulty:     q?.difficulty,
      };
    });

    res.json({
      success: true,
      module_2: { score, max_score: maxScore, percentage, tier: session.module_2.tier, submitted_at: now },
      total_score: updated.total_score,
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/test/:sessionId/results ──────────────────────────────────────
const getResults = async (req, res) => {
  try {
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'complete',
    }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Completed session not found' });

    const allIds = [
      ...session.module_1.question_ids,
      ...(session.module_2?.question_ids || []),
    ];
    const questions  = await SatQuestionBank.find({ _id: { $in: allIds } }).lean();
    const questionMap = Object.fromEntries(questions.map((q) => [q._id.toString(), q]));

    const buildBreakdown = (answers) =>
      (answers || []).map((a) => {
        const q = questionMap[a.question_id?.toString()];
        return {
          question_id:    a.question_id,
          stem:           q?.stem,
          option_a:       q?.option_a,
          option_b:       q?.option_b,
          option_c:       q?.option_c,
          option_d:       q?.option_d,
          topic:          q?.topic,
          sub_topic:      q?.sub_topic,
          difficulty:     q?.difficulty,
          points:         q?.points,
          selected:       a.selected,
          correct_answer: q?.correct_answer,
          is_correct:     a.is_correct,
          explanation:    q?.explanation,
        };
      });

    // Per-topic summary
    const topicSummary = {};
    [...(session.module_1.answers || []), ...(session.module_2?.answers || [])].forEach((a) => {
      const q     = questionMap[a.question_id?.toString()];
      const topic = q?.topic || 'Unknown';
      if (!topicSummary[topic]) topicSummary[topic] = { correct: 0, total: 0 };
      topicSummary[topic].total++;
      if (a.is_correct) topicSummary[topic].correct++;
    });

    res.json({
      success: true,
      data: {
        session_id:  session._id,
        subject:     session.subject,
        status:      session.status,
        total_score: session.total_score,
        module_1: {
          score:      session.module_1.score,
          max_score:  session.module_1.max_score,
          percentage: session.module_1.percentage,
          breakdown:  buildBreakdown(session.module_1.answers),
        },
        module_2: {
          tier:       session.module_2?.tier,
          score:      session.module_2?.score,
          max_score:  session.module_2?.max_score,
          percentage: session.module_2?.percentage,
          breakdown:  buildBreakdown(session.module_2?.answers),
        },
        topic_summary: topicSummary,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Practice Test Handlers ────────────────────────────────────────────────────

// GET /api/sat/test/practice
// Guest users: only is_demo_accessible tests. Paid users: all active.
const listPracticeConfigs = async (req, res) => {
  try {
    const filter = { is_active: true };
    if (req.userRole === 'guest') filter.is_demo_accessible = true;

    const configs = await SatPracticeTestConfig.find(filter)
      .sort({ display_order: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, count: configs.length, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/sat/test/practice/start
// Body: { config_id, assignment_id? }
const startPracticeSession = async (req, res) => {
  try {
    const { config_id, assignment_id } = req.body;
    if (!config_id) return res.status(400).json({ success: false, message: 'config_id is required' });

    const config = await SatPracticeTestConfig.findById(config_id).lean();
    if (!config || !config.is_active) return res.status(404).json({ success: false, message: 'Practice config not found' });

    // Demo/guest users can only access demo-accessible tests
    if (req.userRole === 'guest' && !config.is_demo_accessible) {
      return res.status(403).json({ success: false, message: 'Upgrade to access this practice test' });
    }

    // Resume existing in-progress session for this config
    const existing = await SatPracticeSession.findOne({
      student_id: req.userId,
      practice_config_id: config_id,
      status: 'in_progress',
    }).lean();

    if (existing) {
      const questions = await SatQuestionBank.find({ _id: { $in: existing.question_ids } }).lean();
      return res.json({
        success:    true,
        resumed:    true,
        session_id: existing._id,
        questions:  stripAnswers(questions),
        time_limit_minutes: config.time_limit_minutes,
        started_at: existing.started_at,
      });
    }

    // Get previously seen question IDs for this student in this topic/domain
    const seenSessions = await SatPracticeSession.find({
      student_id:         req.userId,
      practice_config_id: config_id,
      status:             'complete',
    }).select('question_ids').lean();
    const seenIds = seenSessions.flatMap(s => s.question_ids);

    const sub_topic = config.sub_topic || config.domain;
    const questions = await assemblePracticeQuestions(
      config.subject,
      config.topic,
      sub_topic,
      config.difficulty_distribution,
      seenIds
    );

    if (!questions.length) {
      return res.status(400).json({ success: false, message: 'No questions available for this practice test' });
    }

    const session = await SatPracticeSession.create({
      student_id:         req.userId,
      practice_config_id: config._id,
      assignment_id:      assignment_id || undefined,
      status:             'in_progress',
      question_ids:       questions.map(q => q._id),
      started_at:         new Date(),
    });

    // Update assignment status if this is assignment-based
    if (assignment_id) {
      await SatAssignment.findByIdAndUpdate(assignment_id, {
        status:     'in_progress',
        session_id: session._id,
      });
    }

    res.status(201).json({
      success:            true,
      session_id:         session._id,
      questions:          stripAnswers(questions),
      time_limit_minutes: config.time_limit_minutes,
      started_at:         session.started_at,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/sat/test/practice/:sessionId/submit
// Body: { answers: [{ question_id, selected }] }
const submitPractice = async (req, res) => {
  try {
    const session = await SatPracticeSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'in_progress',
    });
    if (!session) return res.status(404).json({ success: false, message: 'Active practice session not found' });

    const { answers = [] } = req.body;
    const questions  = await SatQuestionBank.find({ _id: { $in: session.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    let score = 0;
    const gradedAnswers = session.question_ids.map((qId) => {
      const q        = questionMap[qId.toString()];
      const answer   = answers.find(a => a.question_id?.toString() === qId.toString());
      const selected  = answer?.selected?.trim() || null;
      const correct   = q?.correct_answer?.trim();
      const isCorrect = selected !== null && selected.toLowerCase() === correct?.toLowerCase();
      const pts       = isCorrect ? (q?.points || 1) : 0;
      score += pts;
      return { question_id: qId, selected, is_correct: isCorrect, points_earned: pts };
    });

    const maxScore   = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const now        = new Date();

    await SatPracticeSession.findByIdAndUpdate(session._id, {
      status:       'complete',
      answers:      gradedAnswers,
      score,
      max_score:    maxScore,
      percentage,
      submitted_at: now,
    });

    if (session.assignment_id) {
      await SatAssignment.findByIdAndUpdate(session.assignment_id, { status: 'completed' });
    }

    const breakdown = gradedAnswers.map(a => {
      const q = questionMap[a.question_id.toString()];
      return {
        question_id:    a.question_id,
        stem:           q?.stem,
        option_a:       q?.option_a,
        option_b:       q?.option_b,
        option_c:       q?.option_c,
        option_d:       q?.option_d,
        topic:          q?.topic,
        sub_topic:      q?.sub_topic,
        difficulty:     q?.difficulty,
        selected:       a.selected,
        correct_answer: q?.correct_answer,
        is_correct:     a.is_correct,
        explanation:    q?.explanation,
      };
    });

    res.json({
      success:      true,
      score,
      max_score:    maxScore,
      percentage,
      submitted_at: now,
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sat/test/practice/:sessionId/results
const getPracticeResults = async (req, res) => {
  try {
    const session = await SatPracticeSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'complete',
    }).populate('practice_config_id', 'name subject topic sub_topic').lean();
    if (!session) return res.status(404).json({ success: false, message: 'Completed practice session not found' });

    const questions  = await SatQuestionBank.find({ _id: { $in: session.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    const breakdown = (session.answers || []).map(a => {
      const q = questionMap[a.question_id?.toString()];
      return {
        question_id:    a.question_id,
        stem:           q?.stem,
        option_a:       q?.option_a,
        option_b:       q?.option_b,
        option_c:       q?.option_c,
        option_d:       q?.option_d,
        topic:          q?.topic,
        sub_topic:      q?.sub_topic,
        difficulty:     q?.difficulty,
        points:         q?.points,
        selected:       a.selected,
        correct_answer: q?.correct_answer,
        is_correct:     a.is_correct,
        explanation:    q?.explanation,
      };
    });

    const topicSummary = {};
    (session.answers || []).forEach(a => {
      const q     = questionMap[a.question_id?.toString()];
      const topic = q?.topic || 'Unknown';
      if (!topicSummary[topic]) topicSummary[topic] = { correct: 0, total: 0 };
      topicSummary[topic].total++;
      if (a.is_correct) topicSummary[topic].correct++;
    });

    res.json({
      success: true,
      data: {
        session_id:   session._id,
        config:       session.practice_config_id,
        score:        session.score,
        max_score:    session.max_score,
        percentage:   session.percentage,
        submitted_at: session.submitted_at,
        breakdown,
        topic_summary: topicSummary,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sat/test/practice/history
const getPracticeHistory = async (req, res) => {
  try {
    const sessions = await SatPracticeSession.find({ student_id: req.userId })
      .populate('practice_config_id', 'name subject topic domain')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listExamConfigs,
  startSession, submitModule1, getModule2, submitModule2, getResults,
  listPracticeConfigs, startPracticeSession, submitPractice, getPracticeResults, getPracticeHistory,
};
