const SatTestSession            = require('../../models/sat/SatTestSession');
const SatTestAttempt            = require('../../models/sat/SatTestAttempt');
const SatFullLengthSession      = require('../../models/sat/SatFullLengthSession');
const SatExamConfig             = require('../../models/sat/SatExamConfig');
const SatTestConfig             = require('../../models/sat/SatTestConfig');
const SatFullLengthExamConfig   = require('../../models/sat/SatFullLengthExamConfig');
const SatPracticeTestConfig     = require('../../models/sat/SatPracticeTestConfig');
const SatPracticeSession        = require('../../models/sat/SatPracticeSession');
const SatAssignment             = require('../../models/sat/SatAssignment');
const SatQuestionBank           = require('../../models/sat/SatQuestionBank');
const SatStudentQuestionHistory = require('../../models/sat/SatStudentQuestionHistory');
const { assembleQuestions, assemblePracticeQuestions, stripAnswers } = require('../../utils/satAssembly');

// Returns config data shaped like SatExamConfig.lean() regardless of which schema the session uses.
// New-schema sessions have test_config_id set; old-schema sessions have exam_config_id.
const loadConfigForSession = async (session) => {
  if (session.test_config_id) {
    const tc = await SatTestConfig.findOne({ testId: session.test_config_id }).lean();
    const subj = tc?.subjects?.[session.test_config_subject];
    if (!subj) return null;
    return {
      subject:                   session.test_config_subject,
      adaptive_threshold:        subj.adaptive_threshold,
      adaptive_threshold_medium: 100, // disables medium tier — new schema has only easy/hard
      module_2_medium:           null,
      module_2_hard:             subj.module_2_hard,
      module_2_easy:             subj.module_2_easy,
      is_demo_accessible:        tc.is_demo_accessible,
    };
  }
  return SatExamConfig.findById(session.exam_config_id).lean();
};

// Appends question IDs to the student's seen history for a subject
const recordSeenQuestions = async (studentId, subject, questionIds) => {
  await SatStudentQuestionHistory.findOneAndUpdate(
    { student_id: studentId, subject },
    { $addToSet: { seen_question_ids: { $each: questionIds } } },
    { upsert: true, new: true }
  );
};

// ── GET /api/sat/test/configs ─────────────────────────────────────────────────
// Returns active exam configs from BOTH schemas.
// New SatTestConfig docs are flattened to per-subject entries so the student
// portal (which groups by series name) works without any frontend changes.
// Virtual _id format for new configs: "{testId}:rw" or "{testId}:math"
const listExamConfigs = async (req, res) => {
  try {
    const [oldConfigs, newTestConfigs] = await Promise.all([
      SatExamConfig.find({ is_active: true })
        .select('name subject type adaptive_threshold module_1 is_demo_accessible')
        .sort({ subject: 1, type: 1, name: 1 })
        .lean(),
      SatTestConfig.find({ is_active: true })
        .select('testId name type subjects is_demo_accessible')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const flattenedNew = newTestConfigs.flatMap(tc => {
      const entries = [];
      const pairs = [
        { subjectKey: 'reading_writing', code: 'rw',   label: 'Reading & Writing' },
        { subjectKey: 'math',            code: 'math',  label: 'Math'              },
      ];
      for (const { subjectKey, code, label } of pairs) {
        const subj = tc.subjects?.[subjectKey];
        if (!subj) continue;
        entries.push({
          _id:                `${tc.testId}:${code}`,
          name:               `${tc.name} — ${label}`,
          subject:            subjectKey,
          type:               tc.type,
          adaptive_threshold: subj.adaptive_threshold,
          module_1:           subj.module_1,
          is_demo_accessible: tc.is_demo_accessible,
        });
      }
      return entries;
    });

    res.json({ success: true, data: [...oldConfigs, ...flattenedNew] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/sat/test/start ──────────────────────────────────────────────────
// Body: { assignment_id } OR { exam_config_id }
// exam_config_id may be a real MongoDB ObjectId (old schema) or a virtual
// "{testId}:rw" / "{testId}:math" string (new unified schema).
const startSession = async (req, res) => {
  try {
    const { assignment_id, exam_config_id: directConfigId } = req.body;
    if (!assignment_id && !directConfigId) {
      return res.status(400).json({ success: false, message: 'assignment_id or exam_config_id is required' });
    }

    // ── New unified schema: virtual ID contains a colon ───────────────────────
    if (directConfigId && directConfigId.includes(':')) {
      const colonIdx    = directConfigId.lastIndexOf(':');
      const testId      = directConfigId.substring(0, colonIdx);
      const subjectCode = directConfigId.substring(colonIdx + 1);

      const testConfig = await SatTestConfig.findOne({ testId, is_active: true }).lean();
      if (!testConfig) return res.status(404).json({ success: false, message: 'Test config not found' });

      if (req.userRole === 'guest' && !testConfig.is_demo_accessible) {
        return res.status(403).json({ success: false, message: 'Upgrade to access this test' });
      }

      // ── R&W: create or resume a SatTestAttempt ────────────────────────────
      if (subjectCode === 'rw') {
        const rwConfig = testConfig.subjects?.reading_writing;
        if (!rwConfig) return res.status(404).json({ success: false, message: 'Reading & Writing not configured in this test' });

        // Check for any active (non-complete) attempt to prevent duplicates
        const existing = await SatTestAttempt.findOne({
          student_id:     req.userId,
          test_config_id: testId,
          status:         { $nin: ['complete'] },
        }).lean();

        if (existing) {
          if (existing.status !== 'rw_m1_in_progress') {
            // Already past M1 — don't create a new document, tell client to redirect
            return res.status(409).json({
              success:    false,
              message:    'Test already in progress',
              session_id: existing._id,
              status:     existing.status,
            });
          }
          const questions = await SatQuestionBank.find({ _id: { $in: existing.reading_writing.module_1.question_ids } }).lean();
          return res.json({
            success:    true,
            resumed:    true,
            session_id: existing._id,
            status:     existing.status,
            subject:    'reading_writing',
            module_1: {
              questions:          stripAnswers(questions),
              time_limit_minutes: rwConfig.module_1.time_limit_minutes,
              started_at:         existing.reading_writing.module_1.started_at,
            },
          });
        }

        const history      = await SatStudentQuestionHistory.findOne({ student_id: req.userId, subject: 'reading_writing' }).lean();
        const seenIds      = history?.seen_question_ids || [];
        const m1Questions  = await assembleQuestions('reading_writing', rwConfig.module_1, seenIds);
        const m1Ids        = m1Questions.map(q => q._id);
        const excludeForM2 = [...seenIds, ...m1Ids];

        const [prefetchHard, prefetchEasy] = await Promise.allSettled([
          assembleQuestions('reading_writing', rwConfig.module_2_hard, excludeForM2),
          assembleQuestions('reading_writing', rwConfig.module_2_easy, excludeForM2),
        ]);

        const attempt = await SatTestAttempt.create({
          student_id:     req.userId,
          test_config_id: testId,
          type:           testConfig.type,
          status:         'rw_m1_in_progress',
          reading_writing: {
            module_1:   { question_ids: m1Ids, started_at: new Date() },
            prefetched: {
              hard: prefetchHard.status === 'fulfilled' ? prefetchHard.value.map(q => q._id) : [],
              easy: prefetchEasy.status === 'fulfilled' ? prefetchEasy.value.map(q => q._id) : [],
            },
          },
        });

        return res.status(201).json({
          success:    true,
          session_id: attempt._id,
          status:     attempt.status,
          subject:    'reading_writing',
          module_1: {
            questions:          stripAnswers(m1Questions),
            time_limit_minutes: rwConfig.module_1.time_limit_minutes,
            started_at:         attempt.reading_writing.module_1.started_at,
          },
        });
      }

      // ── Math: find the existing attempt (R&W must be done) ────────────────
      if (subjectCode === 'math') {
        const mathConfig = testConfig.subjects?.math;
        if (!mathConfig) return res.status(404).json({ success: false, message: 'Math not configured in this test' });

        const attempt = await SatTestAttempt.findOne({
          student_id:     req.userId,
          test_config_id: testId,
          status:         'rw_done',
        });
        if (!attempt) {
          return res.status(400).json({ success: false, message: 'Reading & Writing must be completed before starting Math' });
        }

        const history      = await SatStudentQuestionHistory.findOne({ student_id: req.userId, subject: 'math' }).lean();
        const seenIds      = history?.seen_question_ids || [];
        const m1Questions  = await assembleQuestions('math', mathConfig.module_1, seenIds);
        const m1Ids        = m1Questions.map(q => q._id);
        const excludeForM2 = [...seenIds, ...m1Ids];

        const [prefetchHard, prefetchEasy] = await Promise.allSettled([
          assembleQuestions('math', mathConfig.module_2_hard, excludeForM2),
          assembleQuestions('math', mathConfig.module_2_easy, excludeForM2),
        ]);

        attempt.status = 'math_m1_in_progress';
        attempt.math = {
          module_1:   { question_ids: m1Ids, started_at: new Date() },
          prefetched: {
            hard: prefetchHard.status === 'fulfilled' ? prefetchHard.value.map(q => q._id) : [],
            easy: prefetchEasy.status === 'fulfilled' ? prefetchEasy.value.map(q => q._id) : [],
          },
        };
        await attempt.save();

        return res.status(200).json({
          success:    true,
          session_id: attempt._id,
          status:     attempt.status,
          subject:    'math',
          module_1: {
            questions:          stripAnswers(m1Questions),
            time_limit_minutes: mathConfig.module_1.time_limit_minutes,
            started_at:         attempt.math.module_1.started_at,
          },
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid subject code in exam_config_id' });
    }

    // ── Old schema / assignment flow ──────────────────────────────────────────
    let examConfig;
    let assignmentDoc = null;

    if (assignment_id) {
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
          const cfg = await loadConfigForSession(existing);
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
      examConfig = await SatExamConfig.findById(directConfigId);
    }

    if (!examConfig || !examConfig.is_active) {
      return res.status(404).json({ success: false, message: 'Exam config not found' });
    }

    if (req.userRole === 'guest' && !examConfig.is_demo_accessible) {
      return res.status(403).json({ success: false, message: 'Upgrade to access this test' });
    }

    const history  = await SatStudentQuestionHistory.findOne({ student_id: req.userId, subject: examConfig.subject }).lean();
    const seenIds  = history?.seen_question_ids || [];

    const m1Questions  = await assembleQuestions(examConfig.subject, examConfig.module_1, seenIds);
    const m1Ids        = m1Questions.map(q => q._id);
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
      module_1: { question_ids: m1Ids, started_at: new Date() },
      prefetched: {
        hard:   prefetchHard.status   === 'fulfilled' ? prefetchHard.value.map(q   => q._id) : [],
        medium: prefetchMedium.status === 'fulfilled' ? prefetchMedium.value.map(q => q._id) : [],
        easy:   prefetchEasy.status   === 'fulfilled' ? prefetchEasy.value.map(q   => q._id) : [],
      },
    });

    if (assignmentDoc) {
      await SatAssignment.findByIdAndUpdate(assignmentDoc._id, { status: 'in_progress', session_id: session._id });
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

// Shared grading helper — returns { gradedAnswers, score, maxScore, percentage }
const gradeAnswers = (questionIds, answers, questionMap) => {
  let score = 0;
  const gradedAnswers = questionIds.map((qId) => {
    const q        = questionMap[qId.toString()];
    const answer   = answers.find((a) => a.question_id?.toString() === qId.toString());
    const selected  = answer?.selected?.trim() || null;
    const correct   = q?.correct_answer?.trim();
    const isCorrect = selected !== null && selected.toLowerCase() === correct?.toLowerCase();
    const pts       = isCorrect ? (q?.points || 1) : 0;
    score += pts;
    return { question_id: qId, selected, is_correct: isCorrect, points_earned: pts };
  });
  const maxScore   = questionIds.reduce((sum, qId) => sum + (questionMap[qId.toString()]?.points || 1), 0);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { gradedAnswers, score, maxScore, percentage };
};

// Shared breakdown builder
const buildBreakdownFromMap = (gradedAnswers, questionMap) =>
  gradedAnswers.map((a) => {
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

// ── POST /api/sat/test/:sessionId/module/1/submit ─────────────────────────────
// Body: { answers: [{ question_id, selected }] }
const submitModule1 = async (req, res) => {
  try {
    const { answers = [] } = req.body;
    const now = new Date();

    // ── Try SatTestAttempt first (new unified schema) ─────────────────────
    const attempt = await SatTestAttempt.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     { $in: ['rw_m1_in_progress', 'math_m1_in_progress'] },
    });

    if (attempt) {
      const isRW      = attempt.status === 'rw_m1_in_progress';
      const subject   = isRW ? 'reading_writing' : 'math';
      const subjData  = isRW ? attempt.reading_writing : attempt.math;
      const qIds      = subjData.module_1.question_ids;

      const questions   = await SatQuestionBank.find({ _id: { $in: qIds } }).lean();
      const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
      const { gradedAnswers, score, maxScore, percentage } = gradeAnswers(qIds, answers, questionMap);

      // Load subjConfig for adaptive threshold
      const testConfig  = await SatTestConfig.findOne({ testId: attempt.test_config_id }).lean();
      const subjConfig  = testConfig?.subjects?.[subject];
      const threshold   = subjConfig?.adaptive_threshold ?? 50;
      const tier        = percentage >= threshold ? 'hard' : 'easy';
      const prefetchIds = subjData.prefetched?.[tier] || [];

      if (!prefetchIds.length) {
        return res.status(500).json({ success: false, message: `Prefetched questions for ${tier} tier are unavailable. Contact admin.` });
      }

      const nextStatus = isRW ? 'rw_m1_complete' : 'math_m1_complete';
      const m1Path     = isRW ? 'reading_writing.module_1' : 'math.module_1';
      const m2Path     = isRW ? 'reading_writing.module_2' : 'math.module_2';

      await SatTestAttempt.findByIdAndUpdate(attempt._id, {
        status:                      nextStatus,
        [`${m1Path}.answers`]:       gradedAnswers,
        [`${m1Path}.score`]:         score,
        [`${m1Path}.max_score`]:     maxScore,
        [`${m1Path}.percentage`]:    percentage,
        [`${m1Path}.submitted_at`]:  now,
        [`${m2Path}.tier`]:          tier,
        [`${m2Path}.question_ids`]:  prefetchIds,
      });

      await recordSeenQuestions(req.userId, subject, qIds);

      return res.json({
        success:  true,
        module_1: { score, max_score: maxScore, percentage, submitted_at: now },
        adaptive: { tier, threshold },
        breakdown: buildBreakdownFromMap(gradedAnswers, questionMap),
      });
    }

    // ── Fall back to SatTestSession (old schema) ──────────────────────────
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'm1_in_progress',
    });
    if (!session) return res.status(404).json({ success: false, message: 'Active Module 1 session not found' });

    const examConfig  = await loadConfigForSession(session);
    const questions   = await SatQuestionBank.find({ _id: { $in: session.module_1.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map((q) => [q._id.toString(), q]));
    const { gradedAnswers, score, maxScore, percentage } = gradeAnswers(session.module_1.question_ids, answers, questionMap);

    let tier;
    if (percentage >= examConfig.adaptive_threshold) {
      tier = 'hard';
    } else if (percentage >= (examConfig.adaptive_threshold_medium ?? 40) && examConfig.module_2_medium) {
      tier = 'medium';
    } else {
      tier = 'easy';
    }

    const prefetchedIds = session.prefetched[tier];
    if (!prefetchedIds?.length) {
      return res.status(500).json({ success: false, message: `Prefetched questions for ${tier} tier are unavailable. Contact admin.` });
    }

    await SatTestSession.findByIdAndUpdate(session._id, {
      status:                  'm1_complete',
      'module_1.answers':      gradedAnswers,
      'module_1.score':        score,
      'module_1.max_score':    maxScore,
      'module_1.percentage':   percentage,
      'module_1.submitted_at': now,
      'module_2.tier':         tier,
      'module_2.question_ids': prefetchedIds,
    });

    await recordSeenQuestions(req.userId, session.subject, session.module_1.question_ids);

    res.json({
      success:  true,
      module_1: { score, max_score: maxScore, percentage, submitted_at: now },
      adaptive: { tier, threshold: examConfig.adaptive_threshold },
      breakdown: buildBreakdownFromMap(gradedAnswers, questionMap),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/test/:sessionId/module/2 ─────────────────────────────────────
const getModule2 = async (req, res) => {
  try {
    // ── Try SatTestAttempt first ──────────────────────────────────────────
    const attempt = await SatTestAttempt.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     { $in: ['rw_m1_complete', 'rw_m2_in_progress', 'math_m1_complete', 'math_m2_in_progress'] },
    });

    if (attempt) {
      const isRW     = attempt.status === 'rw_m1_complete' || attempt.status === 'rw_m2_in_progress';
      const subject  = isRW ? 'reading_writing' : 'math';
      const subjData = isRW ? attempt.reading_writing : attempt.math;

      const testConfig = await SatTestConfig.findOne({ testId: attempt.test_config_id }).lean();
      const subjConfig = testConfig?.subjects?.[subject];
      const m2Cfg      = subjData.module_2?.tier === 'hard' ? subjConfig?.module_2_hard : subjConfig?.module_2_easy;

      const questions = await SatQuestionBank.find({ _id: { $in: subjData.module_2.question_ids } }).lean();

      const m2Path     = isRW ? 'reading_writing.module_2' : 'math.module_2';
      const nextStatus = isRW ? 'rw_m2_in_progress' : 'math_m2_in_progress';

      if (attempt.status === 'rw_m1_complete' || attempt.status === 'math_m1_complete') {
        await SatTestAttempt.findByIdAndUpdate(attempt._id, {
          status:                    nextStatus,
          [`${m2Path}.started_at`]: new Date(),
        });
      }

      return res.json({
        success:    true,
        session_id: attempt._id,
        module_2: {
          tier:               subjData.module_2.tier,
          questions:          stripAnswers(questions),
          time_limit_minutes: m2Cfg?.time_limit_minutes,
          started_at:         subjData.module_2.started_at || new Date(),
        },
      });
    }

    // ── Fall back to SatTestSession ───────────────────────────────────────
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     { $in: ['m1_complete', 'm2_in_progress'] },
    });
    if (!session) return res.status(404).json({ success: false, message: 'Session not ready for Module 2' });

    const examConfig = await loadConfigForSession(session);
    const m2Config   = session.module_2.tier === 'hard' ? examConfig.module_2_hard : examConfig.module_2_easy;
    const questions  = await SatQuestionBank.find({ _id: { $in: session.module_2.question_ids } }).lean();

    if (session.status === 'm1_complete') {
      await SatTestSession.findByIdAndUpdate(session._id, {
        status:                'm2_in_progress',
        'module_2.started_at': new Date(),
      });
    }

    res.json({
      success:    true,
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
    const { answers = [] } = req.body;
    const now = new Date();

    // ── Try SatTestAttempt first ──────────────────────────────────────────
    const attempt = await SatTestAttempt.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     { $in: ['rw_m2_in_progress', 'math_m2_in_progress'] },
    });

    if (attempt) {
      const isRW      = attempt.status === 'rw_m2_in_progress';
      const subject   = isRW ? 'reading_writing' : 'math';
      const subjData  = isRW ? attempt.reading_writing : attempt.math;
      const qIds      = subjData.module_2.question_ids;

      const questions   = await SatQuestionBank.find({ _id: { $in: qIds } }).lean();
      const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
      const { gradedAnswers, score, maxScore, percentage } = gradeAnswers(qIds, answers, questionMap);

      const m1Score  = subjData.module_1?.score || 0;
      const m2Path   = isRW ? 'reading_writing.module_2' : 'math.module_2';
      const totPath  = isRW ? 'reading_writing.total_score' : 'math.total_score';

      if (isRW) {
        // R&W done — move to rw_done, do NOT compute overall yet
        await SatTestAttempt.findByIdAndUpdate(attempt._id, {
          status:                     'rw_done',
          [`${m2Path}.answers`]:      gradedAnswers,
          [`${m2Path}.score`]:        score,
          [`${m2Path}.max_score`]:    maxScore,
          [`${m2Path}.percentage`]:   percentage,
          [`${m2Path}.submitted_at`]: now,
          [totPath]:                  m1Score + score,
        });
      } else {
        // Math done — whole attempt complete, compute overall_score
        const rwTotal      = attempt.reading_writing?.total_score || 0;
        const mathTotal    = m1Score + score;
        const overallScore = rwTotal + mathTotal;

        await SatTestAttempt.findByIdAndUpdate(attempt._id, {
          status:                     'complete',
          [`${m2Path}.answers`]:      gradedAnswers,
          [`${m2Path}.score`]:        score,
          [`${m2Path}.max_score`]:    maxScore,
          [`${m2Path}.percentage`]:   percentage,
          [`${m2Path}.submitted_at`]: now,
          [totPath]:                  mathTotal,
          overall_score:              overallScore,
        });
      }

      await recordSeenQuestions(req.userId, subject, qIds);

      return res.json({
        success:  true,
        module_2: { score, max_score: maxScore, percentage, tier: subjData.module_2.tier, submitted_at: now },
        total_score: m1Score + score,
        breakdown: buildBreakdownFromMap(gradedAnswers, questionMap),
      });
    }

    // ── Fall back to SatTestSession ───────────────────────────────────────
    const session = await SatTestSession.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'm2_in_progress',
    });
    if (!session) return res.status(404).json({ success: false, message: 'Active Module 2 session not found' });

    const questions   = await SatQuestionBank.find({ _id: { $in: session.module_2.question_ids } }).lean();
    const questionMap = Object.fromEntries(questions.map((q) => [q._id.toString(), q]));
    const { gradedAnswers, score, maxScore, percentage } = gradeAnswers(session.module_2.question_ids, answers, questionMap);

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

    await recordSeenQuestions(req.userId, session.subject, session.module_2.question_ids);
    await SatAssignment.findByIdAndUpdate(session.assignment_id, { status: 'completed' });

    if (session.full_length_session_id) {
      const flSession = await SatFullLengthSession.findById(session.full_length_session_id);
      if (flSession) {
        const mathSession = await SatTestSession.findById(flSession.math_session_id).lean();
        const rwSession   = await SatTestSession.findById(flSession.rw_session_id).lean();
        if (mathSession?.status === 'complete' && rwSession?.status === 'complete') {
          await SatFullLengthSession.findByIdAndUpdate(session.full_length_session_id, {
            status:      'complete',
            total_score: (mathSession.total_score || 0) + (rwSession.total_score || 0),
          });
        }
      }
    }

    res.json({
      success:     true,
      module_2:    { score, max_score: maxScore, percentage, tier: session.module_2.tier, submitted_at: now },
      total_score: updated.total_score,
      breakdown:   buildBreakdownFromMap(gradedAnswers, questionMap),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/sat/test/:sessionId/results ──────────────────────────────────────
const getResults = async (req, res) => {
  try {
    // ── Try SatTestAttempt first ──────────────────────────────────────────
    const attempt = await SatTestAttempt.findOne({
      _id:        req.params.sessionId,
      student_id: req.userId,
      status:     'complete',
    }).lean();

    if (attempt) {
      const allIds = [
        ...(attempt.reading_writing?.module_1?.question_ids || []),
        ...(attempt.reading_writing?.module_2?.question_ids || []),
        ...(attempt.math?.module_1?.question_ids || []),
        ...(attempt.math?.module_2?.question_ids || []),
      ];
      const questions   = await SatQuestionBank.find({ _id: { $in: allIds } }).lean();
      const questionMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

      const buildBreakdown = (answers) =>
        (answers || []).map(a => {
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

      const buildSubjectResult = (subj) => ({
        module_1: {
          score:      subj?.module_1?.score,
          max_score:  subj?.module_1?.max_score,
          percentage: subj?.module_1?.percentage,
          breakdown:  buildBreakdown(subj?.module_1?.answers),
        },
        module_2: {
          tier:       subj?.module_2?.tier,
          score:      subj?.module_2?.score,
          max_score:  subj?.module_2?.max_score,
          percentage: subj?.module_2?.percentage,
          breakdown:  buildBreakdown(subj?.module_2?.answers),
        },
        total_score: subj?.total_score,
      });

      return res.json({
        success: true,
        data: {
          session_id:      attempt._id,
          is_unified:      true,
          overall_score:   attempt.overall_score,
          reading_writing: buildSubjectResult(attempt.reading_writing),
          math:            buildSubjectResult(attempt.math),
        },
      });
    }

    // ── Fall back to SatTestSession ───────────────────────────────────────
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
    const questions   = await SatQuestionBank.find({ _id: { $in: allIds } }).lean();
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
    const configs = await SatPracticeTestConfig.find({ is_active: true })
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
      subject:            config.subject,
      sub_topic:          config.sub_topic || config.domain || config.topic,
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

// GET /api/sat/test/history — completed sessions for the student (both collections)
const getHistory = async (req, res) => {
  try {
    const [sessions, attempts] = await Promise.all([
      SatTestSession.find({ student_id: req.userId, status: 'complete' })
        .select('exam_config_id test_config_id test_config_subject subject status total_score module_1.score module_1.max_score module_2.score module_2.max_score createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      SatTestAttempt.find({ student_id: req.userId, status: 'complete' })
        .select('test_config_id type status overall_score reading_writing.total_score reading_writing.module_1.score reading_writing.module_1.max_score reading_writing.module_2.score reading_writing.module_2.max_score math.total_score math.module_1.score math.module_1.max_score math.module_2.score math.module_2.max_score createdAt')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Normalize old SatTestSession entries (add synthetic exam_config_id for new-schema sessions)
    const normalizedSessions = sessions.map(s => {
      if (s.test_config_id && !s.exam_config_id) {
        const code = s.test_config_subject === 'math' ? 'math' : 'rw';
        return { ...s, exam_config_id: `${s.test_config_id}:${code}` };
      }
      return s;
    });

    // Expand each SatTestAttempt into two synthetic entries (one per subject)
    // so existing frontend matchId logic works unchanged.
    const normalizedAttempts = attempts.flatMap(a => [
      {
        _id:           a._id,
        exam_config_id: `${a.test_config_id}:rw`,
        status:        'complete',
        total_score:   a.reading_writing?.total_score,
        module_1:      { score: a.reading_writing?.module_1?.score, max_score: a.reading_writing?.module_1?.max_score },
        module_2:      { score: a.reading_writing?.module_2?.score, max_score: a.reading_writing?.module_2?.max_score },
        createdAt:     a.createdAt,
      },
      {
        _id:           a._id,
        exam_config_id: `${a.test_config_id}:math`,
        status:        'complete',
        total_score:   a.math?.total_score,
        module_1:      { score: a.math?.module_1?.score, max_score: a.math?.module_1?.max_score },
        module_2:      { score: a.math?.module_2?.score, max_score: a.math?.module_2?.max_score },
        createdAt:     a.createdAt,
      },
    ]);

    const data = [...normalizedSessions, ...normalizedAttempts]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listExamConfigs,
  startSession, submitModule1, getModule2, submitModule2, getResults,
  listPracticeConfigs, startPracticeSession, submitPractice, getPracticeResults, getPracticeHistory, getHistory,
};
